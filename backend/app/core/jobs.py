"""Agent task queue — arq (Redis) worker + Mongo persistence.

Two concerns kept deliberately separate:

- `agent_tasks` (Mongo) is the durable record that the UI and audit log use.
  Fields: id, kind, department, status, progress, logs[], result, error,
          created_by, created_at, updated_at, started_at, finished_at.

- arq is the execution runtime. A single worker process consumes jobs and
  calls the registered handler, which receives a `Ctx` with a `TaskLogger`
  helper that updates the Mongo document and streams progress events back to
  the owner over the WS bus so the /tasks page lights up live.

Every handler is a plain async function — easy to test, easy to add new
long-running jobs (reports, bulk email, data exports, agent-initiated
workflows) without touching the API surface.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Callable

from arq import ArqRedis, create_pool
from arq.connections import RedisSettings
from bson import ObjectId

from app.core.config import settings
from app.core.events import publish as publish_event
from app.core.mongo import mongo_db

log = logging.getLogger("agent_tasks")

# Task kinds registered by handlers below. Keep the set explicit so the UI
# can whitelist what a user is allowed to kick off.
TASK_KINDS: set[str] = set()
HANDLERS: dict[str, Callable] = {}


def redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(settings.REDIS_URL)


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- Mongo helpers -------------------------------------------------


async def ensure_indexes() -> None:
    try:
        await mongo_db["agent_tasks"].create_index([("created_at", -1)])
        await mongo_db["agent_tasks"].create_index("created_by")
        await mongo_db["agent_tasks"].create_index("status")
        await mongo_db["agent_tasks"].create_index("kind")
    except Exception as exc:  # pragma: no cover
        log.warning("agent_tasks index creation failed: %s", exc)


async def _serialize(doc: dict) -> dict:
    if not doc:
        return {}
    return {
        "id": str(doc.get("_id")),
        "kind": doc.get("kind"),
        "department": doc.get("department"),
        "title": doc.get("title"),
        "status": doc.get("status"),
        "progress": doc.get("progress", 0),
        "logs": doc.get("logs") or [],
        "result": doc.get("result"),
        "error": doc.get("error"),
        "params": doc.get("params") or {},
        "created_by": doc.get("created_by"),
        "created_at": (doc.get("created_at") or _now()).isoformat()
        if isinstance(doc.get("created_at"), datetime) else doc.get("created_at"),
        "updated_at": (doc.get("updated_at") or _now()).isoformat()
        if isinstance(doc.get("updated_at"), datetime) else doc.get("updated_at"),
        "started_at": doc.get("started_at").isoformat()
        if isinstance(doc.get("started_at"), datetime) else doc.get("started_at"),
        "finished_at": doc.get("finished_at").isoformat()
        if isinstance(doc.get("finished_at"), datetime) else doc.get("finished_at"),
    }


async def create_task_record(
    *,
    kind: str,
    title: str,
    department: str | None,
    params: dict[str, Any],
    created_by: str,
) -> dict:
    doc = {
        "kind": kind,
        "title": title,
        "department": department,
        "params": params,
        "created_by": created_by,
        "status": "pending",
        "progress": 0,
        "logs": [],
        "created_at": _now(),
        "updated_at": _now(),
    }
    res = await mongo_db["agent_tasks"].insert_one(doc)
    doc["_id"] = res.inserted_id
    return await _serialize(doc)


class TaskLogger:
    """Handed to every task handler — updates Mongo + streams to the owner."""

    def __init__(self, task_id: str, owner: str) -> None:
        self.task_id = task_id
        self.owner = owner

    async def _set(self, fields: dict) -> None:
        fields["updated_at"] = _now()
        await mongo_db["agent_tasks"].update_one({"_id": ObjectId(self.task_id)}, {"$set": fields})
        doc = await mongo_db["agent_tasks"].find_one({"_id": ObjectId(self.task_id)})
        if doc:
            await publish_event(self.owner, {
                "type": "agent_task_update",
                "task": await _serialize(doc),
            })

    async def start(self) -> None:
        await self._set({"status": "running", "started_at": _now(), "progress": 1})

    async def progress(self, *, pct: int, message: str | None = None) -> None:
        pct = max(0, min(100, int(pct)))
        update: dict[str, Any] = {"progress": pct}
        if message:
            await mongo_db["agent_tasks"].update_one(
                {"_id": ObjectId(self.task_id)},
                {"$push": {"logs": {"at": _now().isoformat(), "message": message}}},
            )
        await self._set(update)

    async def succeed(self, result: Any = None) -> None:
        await self._set({"status": "succeeded", "progress": 100, "result": result, "finished_at": _now()})
        try:
            from app.core.notifications import notify
            doc = await mongo_db["agent_tasks"].find_one({"_id": ObjectId(self.task_id)}, {"_id": 0, "title": 1, "kind": 1})
            title = (doc or {}).get("title") or (doc or {}).get("kind") or "Agent job"
            await notify(
                recipient_email=self.owner,
                kind="job",
                title=f"{title} finished",
                body="Your agent job completed successfully.",
                link=f"/tasks?tab=agent&job={self.task_id}",
                metadata={"job_id": self.task_id, "result_kind": "success"},
            )
        except Exception:  # pragma: no cover
            pass

    async def fail(self, error: str) -> None:
        await self._set({"status": "failed", "error": error, "finished_at": _now()})
        try:
            from app.core.notifications import notify
            doc = await mongo_db["agent_tasks"].find_one({"_id": ObjectId(self.task_id)}, {"_id": 0, "title": 1, "kind": 1})
            title = (doc or {}).get("title") or (doc or {}).get("kind") or "Agent job"
            await notify(
                recipient_email=self.owner,
                kind="job",
                title=f"{title} failed",
                body=error[:200] if error else "Agent job failed — check the logs",
                link=f"/tasks?tab=agent&job={self.task_id}",
                metadata={"job_id": self.task_id, "result_kind": "failure"},
            )
        except Exception:  # pragma: no cover
            pass


# ---------- arq job wrapper -----------------------------------------------


async def run_task(ctx: dict, task_id: str) -> None:
    """arq job function — dispatches to the right handler by kind.
    Auto-retries once on failure before marking as failed."""
    doc = await mongo_db["agent_tasks"].find_one({"_id": ObjectId(task_id)})
    if not doc:
        log.warning("run_task: task %s not found", task_id)
        return
    kind = doc["kind"]
    handler = HANDLERS.get(kind)
    tracker = TaskLogger(task_id=task_id, owner=doc["created_by"])
    if not handler:
        await tracker.fail(f"No handler registered for kind={kind!r}")
        return
    await tracker.start()
    max_attempts = 2
    last_error = ""
    for attempt in range(1, max_attempts + 1):
        try:
            result = await handler(tracker, doc.get("params") or {})
            await tracker.succeed(result)
            return
        except Exception as exc:
            last_error = str(exc)
            log.warning("handler %s attempt %d/%d failed: %s", kind, attempt, max_attempts, exc)
            if attempt < max_attempts:
                await tracker.progress(pct=5, message=f"Retrying (attempt {attempt + 1})…")
                import asyncio
                await asyncio.sleep(2)
    log.exception("handler %s failed after %d attempts", kind, max_attempts)
    await tracker.fail(last_error)


def register_handler(kind: str):
    def wrap(fn: Callable):
        HANDLERS[kind] = fn
        TASK_KINDS.add(kind)
        return fn
    return wrap


# ---------- API used by routers -------------------------------------------


async def enqueue(
    *,
    kind: str,
    title: str,
    department: str | None,
    params: dict[str, Any],
    created_by: str,
) -> dict:
    if kind not in TASK_KINDS:
        raise ValueError(f"Unknown task kind: {kind}")
    task = await create_task_record(
        kind=kind,
        title=title,
        department=department,
        params=params,
        created_by=created_by,
    )
    pool: ArqRedis = await create_pool(redis_settings())
    try:
        await pool.enqueue_job("run_task", task["id"])
    finally:
        await pool.close()
    return task

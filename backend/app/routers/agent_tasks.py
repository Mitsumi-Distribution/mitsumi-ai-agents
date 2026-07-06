"""Agent task API — enqueue + list + fetch + cancel.

Used by the Tasks page to show agent-initiated jobs alongside the manual
to-do items. Enqueueing returns the Mongo record immediately; the worker
picks it up from Redis moments later and streams progress events via WS.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_full
from app.core.jobs import TASK_KINDS, enqueue
from app.core.mongo import mongo_db

# Register handlers so TASK_KINDS is populated before the first request.
from app.core import handlers  # noqa: F401

router = APIRouter(prefix="/agent-tasks", tags=["agent-tasks"])


def _serialize(doc: dict[str, Any]) -> dict[str, Any]:
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
        "created_at": _iso(doc.get("created_at")),
        "updated_at": _iso(doc.get("updated_at")),
        "started_at": _iso(doc.get("started_at")),
        "finished_at": _iso(doc.get("finished_at")),
    }


def _iso(value) -> str | None:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    return value


class EnqueueRequest(BaseModel):
    kind: str
    title: str = Field(min_length=1)
    department: str | None = None
    params: dict[str, Any] = Field(default_factory=dict)


@router.get("/kinds")
async def list_kinds(user=Depends(get_current_user_full)) -> dict:
    return {"kinds": sorted(TASK_KINDS)}


@router.get("")
async def list_agent_tasks(
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    user=Depends(get_current_user_full),
) -> list[dict]:
    filt: dict[str, Any] = {"created_by": user["email"]}
    if status:
        filt["status"] = status
    cursor = mongo_db["agent_tasks"].find(filt).sort("created_at", -1).limit(limit)
    return [_serialize(doc) async for doc in cursor]


@router.post("")
async def enqueue_task(payload: EnqueueRequest, user=Depends(get_current_user_full)) -> dict:
    if payload.kind not in TASK_KINDS:
        raise HTTPException(status_code=400, detail=f"Unknown task kind: {payload.kind}")
    task = await enqueue(
        kind=payload.kind,
        title=payload.title,
        department=payload.department,
        params=payload.params,
        created_by=user["email"],
    )
    return task


@router.get("/{task_id}")
async def get_agent_task(task_id: str, user=Depends(get_current_user_full)) -> dict:
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task id")
    doc = await mongo_db["agent_tasks"].find_one({"_id": ObjectId(task_id), "created_by": user["email"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    return _serialize(doc)


@router.post("/{task_id}/cancel")
async def cancel_agent_task(task_id: str, user=Depends(get_current_user_full)) -> dict:
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task id")
    doc = await mongo_db["agent_tasks"].find_one({"_id": ObjectId(task_id), "created_by": user["email"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    if doc["status"] in ("succeeded", "failed", "cancelled"):
        return _serialize(doc)
    # Best-effort: flag as cancelled. The worker doesn't interrupt a running
    # handler mid-flight, but future steps that check `status` can bail out.
    await mongo_db["agent_tasks"].update_one(
        {"_id": doc["_id"]},
        {"$set": {"status": "cancelled", "finished_at": datetime.now(timezone.utc)}},
    )
    doc["status"] = "cancelled"
    return _serialize(doc)


@router.post("/{task_id}/retry")
async def retry_agent_task(task_id: str, user=Depends(get_current_user_full)) -> dict:
    """Re-enqueue a failed / cancelled job with the same params."""
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task id")
    doc = await mongo_db["agent_tasks"].find_one({"_id": ObjectId(task_id), "created_by": user["email"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    if doc["status"] not in ("failed", "cancelled"):
        raise HTTPException(status_code=400, detail="Only failed or cancelled jobs can be retried")
    task = await enqueue(
        kind=doc["kind"],
        title=f"[retry] {doc.get('title') or doc['kind']}",
        department=doc.get("department"),
        params=doc.get("params") or {},
        created_by=user["email"],
    )
    return task

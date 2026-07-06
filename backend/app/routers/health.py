"""System health endpoint.

Surfaces the live status of every moving part of the platform so admins can
diagnose what's missing (usually an API key) without shelling into the server.

Returns a structured response per check:
    {
      "overall": "healthy" | "degraded" | "down",
      "generated_at": iso-string,
      "services": [
        {"key": str, "label": str, "status": "up"|"down"|"warning"|"unknown",
         "detail": str, "hint": str | None, "latency_ms": int | None, "meta": {...}}
      ]
    }

Expensive calls (Redis/Mongo ping) run in parallel via asyncio.gather. Each
check is wrapped so one failure never cascades the whole response.
"""

from __future__ import annotations

import asyncio
import os
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user_full
from app.core.config import settings
from app.core.mongo import mongo_db
from app.core.scope import ADMIN_ROLES

router = APIRouter(prefix="/health", tags=["health"])


async def _require_admin(user: dict) -> None:
    if user.get("is_super_admin"):
        return
    roles = set(user.get("roles") or [])
    if roles & ADMIN_ROLES:
        return
    raise HTTPException(status_code=403, detail="Admins only")


def _svc(
    key: str,
    label: str,
    *,
    status: str,
    detail: str,
    hint: str | None = None,
    latency_ms: int | None = None,
    meta: dict | None = None,
    category: str = "core",
) -> dict:
    return {
        "key": key,
        "label": label,
        "status": status,
        "detail": detail,
        "hint": hint,
        "latency_ms": latency_ms,
        "meta": meta or {},
        "category": category,
    }


async def _check_mongo() -> dict:
    t0 = time.perf_counter()
    try:
        await asyncio.wait_for(mongo_db.command("ping"), timeout=3.0)
        users = await mongo_db["users"].estimated_document_count()
        tasks = await mongo_db["tasks"].estimated_document_count()
        latency = int((time.perf_counter() - t0) * 1000)
        return _svc(
            "mongodb",
            "MongoDB",
            status="up",
            detail=f"Ping OK · {users} users · {tasks} tasks",
            latency_ms=latency,
            meta={"db": settings.MONGODB_DB, "users": users, "tasks": tasks},
        )
    except Exception as exc:
        return _svc(
            "mongodb",
            "MongoDB",
            status="down",
            detail=f"Ping failed: {exc}",
            hint="Verify MONGO_URL in backend/.env and that mongod is running.",
        )


async def _check_redis() -> dict:
    try:
        from redis.asyncio import from_url
    except Exception as exc:  # pragma: no cover
        return _svc("redis", "Redis", status="down", detail=f"redis library not installed: {exc}")
    url = settings.REDIS_URL
    if not url:
        return _svc(
            "redis",
            "Redis",
            status="down",
            detail="REDIS_URL env var is empty",
            hint="Set REDIS_URL=redis://localhost:6379 in backend/.env",
        )
    t0 = time.perf_counter()
    client = None
    try:
        client = from_url(url, socket_connect_timeout=2.0, socket_timeout=2.0)
        pong = await asyncio.wait_for(client.ping(), timeout=3.0)
        latency = int((time.perf_counter() - t0) * 1000)
        return _svc(
            "redis",
            "Redis",
            status="up" if pong else "warning",
            detail="Ping OK" if pong else "Unexpected ping response",
            latency_ms=latency,
            meta={"url": url},
        )
    except Exception as exc:
        return _svc(
            "redis",
            "Redis",
            status="down",
            detail=f"Ping failed: {exc}",
            hint="Check that the Redis service is running under supervisor.",
        )
    finally:
        if client is not None:
            try:
                await client.close()
            except Exception:  # pragma: no cover
                pass


async def _check_agent_worker() -> dict:
    """We can't ping the worker process directly from the web process, but we
    can check the `agent_tasks` collection for recent activity and the arq
    queue length in Redis.
    """
    try:
        recent = await mongo_db["agent_tasks"].find_one(
            {}, sort=[("updated_at", -1)], projection={"_id": 0, "status": 1, "updated_at": 1, "kind": 1}
        )
        pending = await mongo_db["agent_tasks"].count_documents({"status": {"$in": ["pending", "running"]}})
        if not recent:
            return _svc(
                "agent_worker",
                "Agent Worker (arq)",
                status="warning",
                detail="No jobs have ever been enqueued",
                hint="Enqueue a demo_echo job from the Tasks → Agent Jobs tab to verify the worker.",
                meta={"pending": pending},
                category="workers",
            )
        last_update = recent.get("updated_at")
        if isinstance(last_update, datetime):
            # Mongo may return tz-naive — normalise to UTC before subtracting.
            if last_update.tzinfo is None:
                last_update = last_update.replace(tzinfo=timezone.utc)
            age_sec = (datetime.now(timezone.utc) - last_update).total_seconds()
            if pending > 0 and age_sec > 120:
                return _svc(
                    "agent_worker",
                    "Agent Worker (arq)",
                    status="warning",
                    detail=f"{pending} job(s) pending · last update {int(age_sec)}s ago",
                    hint="The worker may be stuck — check /var/log/supervisor/agent-worker.err.log",
                    meta={"pending": pending, "last_kind": recent.get("kind")},
                    category="workers",
                )
        return _svc(
            "agent_worker",
            "Agent Worker (arq)",
            status="up",
            detail=f"{pending} job(s) in flight · last kind: {recent.get('kind')}",
            meta={"pending": pending, "last_kind": recent.get("kind")},
            category="workers",
        )
    except Exception as exc:
        return _svc(
            "agent_worker",
            "Agent Worker (arq)",
            status="warning",
            detail=f"Couldn't inspect queue: {exc}",
            category="workers",
        )


def _key_check(
    key: str,
    label: str,
    env_value: str | None,
    *,
    hint: str,
    category: str = "integrations",
) -> dict:
    if env_value and env_value.strip() and env_value not in ("CHANGE_ME", "changeme"):
        masked = env_value[:4] + "…" + env_value[-4:] if len(env_value) > 10 else "(configured)"
        return _svc(key, label, status="up", detail=f"Configured ({masked})", category=category)
    return _svc(
        key,
        label,
        status="warning",
        detail="API key is not configured",
        hint=hint,
        category=category,
    )


def _check_llm() -> dict:
    provider = settings.LLM_PROVIDER or "unknown"
    model = settings.LLM_MODEL or "unknown"
    if settings.is_bedrock:
        if settings.bedrock_ready:
            region = settings.AWS_REGION
            return _svc(
                "llm",
                f"LLM · Bedrock/{model}",
                status="up",
                detail=f"AWS Bedrock · Region: {region} · Model: {model}",
                meta={"provider": "bedrock", "model": model, "region": region},
                category="integrations",
            )
        return _svc(
            "llm",
            f"LLM · Bedrock/{model}",
            status="warning",
            detail="AWS Bedrock credentials incomplete — chats will skip",
            hint="Set AWS_REGION, AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY in backend/.env",
            category="integrations",
        )
    if not settings.LLM_API_KEY:
        return _svc(
            "llm",
            f"LLM · {provider}/{model}",
            status="warning",
            detail="LLM_API_KEY is not configured — chats and `run_agent_prompt` will skip",
            hint="Set LLM_API_KEY in backend/.env and restart the backend",
            category="integrations",
        )
    return _svc(
        "llm",
        f"LLM · {provider}/{model}",
        status="up",
        detail=f"Provider: {provider} · Model: {model}",
        category="integrations",
    )


@router.get("")
async def get_health(user=Depends(get_current_user_full)) -> dict:
    await _require_admin(user)
    mongo_res, redis_res, worker_res = await asyncio.gather(
        _check_mongo(),
        _check_redis(),
        _check_agent_worker(),
        return_exceptions=False,
    )

    backend = _svc(
        "backend",
        "Backend (FastAPI)",
        status="up",
        detail="Responding to requests",
        meta={"version": "1.0.0"},
    )

    services = [
        backend,
        mongo_res,
        redis_res,
        worker_res,
        _check_llm(),
        _key_check(
            "resend",
            "Resend (Email)",
            settings.RESEND_API_KEY,
            hint="Set RESEND_API_KEY in backend/.env to enable real email delivery.",
        ),
        _key_check(
            "tavily",
            "Tavily (Web Search)",
            settings.TAVILY_API_KEY,
            hint="Set TAVILY_API_KEY in backend/.env to enable the `web_search` tool.",
        ),
        _key_check(
            "google",
            "Google (Calendar)",
            os.environ.get("GOOGLE_API_KEY", ""),
            hint="Set GOOGLE_API_KEY in backend/.env to enable `calendar_event` tool.",
        ),
    ]

    worst = "up"
    for s in services:
        if s["status"] == "down":
            worst = "down"
            break
        if s["status"] == "warning" and worst != "down":
            worst = "warning"

    overall = {"up": "healthy", "warning": "degraded", "down": "down"}[worst]

    return {
        "overall": overall,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "services": services,
    }


# Public, unauth'd liveness probe (used by load balancers / uptime checks).
# Keeps the shape trivial so it never leaks any secrets.
@router.get("/live")
async def liveness() -> dict:
    return {"ok": True, "at": datetime.now(timezone.utc).isoformat(timespec="seconds")}

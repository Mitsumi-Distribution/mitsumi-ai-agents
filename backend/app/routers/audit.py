"""Audit log read API. Admin-only."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user_full
from app.core.mongo import mongo_db
from app.core.scope import ADMIN_ROLES

router = APIRouter(prefix="/audit-log", tags=["audit"])


def _serialize(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc.get("_id")),
        "action": doc.get("action"),
        "actor_email": doc.get("actor_email"),
        "actor_name": doc.get("actor_name"),
        "actor_roles": doc.get("actor_roles") or [],
        "target": doc.get("target"),
        "metadata": doc.get("metadata") or {},
        "created_at": doc["created_at"].astimezone(timezone.utc).isoformat()
        if isinstance(doc.get("created_at"), datetime)
        else doc.get("created_at"),
    }


async def _require_admin(user: dict) -> None:
    if user.get("is_super_admin"):
        return
    if any(r in ADMIN_ROLES for r in (user.get("roles") or [])):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")


@router.get("")
async def list_audit(
    action: str | None = Query(default=None),
    actor: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
    user=Depends(get_current_user_full),
) -> dict:
    await _require_admin(user)
    filt: dict[str, Any] = {}
    if action:
        filt["action"] = action
    if actor:
        filt["actor_email"] = actor
    total = await mongo_db["audit_logs"].count_documents(filt)
    cursor = (
        mongo_db["audit_logs"]
        .find(filt)
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    items = [_serialize(doc) async for doc in cursor]
    return {"items": items, "total": total, "skip": skip, "limit": limit}

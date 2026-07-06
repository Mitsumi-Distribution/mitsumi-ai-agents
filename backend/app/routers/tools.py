"""Tool run history for the Tool Results page.

Reads `messages` + `chats` for the current user and extracts tool events so
the UI can render a recent-runs timeline across all agents.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.core.auth import get_current_user_full
from app.core.mongo import mongo_db

router = APIRouter(prefix="/tools", tags=["tools"])


def _serialize(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    if isinstance(value, dict):
        return {k: _serialize(v) for k, v in value.items() if k != "_id"}
    if isinstance(value, list):
        return [_serialize(v) for v in value]
    return value


@router.get("/recent")
async def recent_tool_runs(limit: int = Query(default=40, ge=1, le=200), user=Depends(get_current_user_full)) -> list[dict]:
    chats_cursor = mongo_db["chats"].find({"user_id": user["email"]}, {"_id": 1, "agent_name": 1, "title": 1})
    chat_index: dict[str, dict] = {}
    async for c in chats_cursor:
        chat_index[str(c["_id"])] = {"chat_id": str(c["_id"]), "agent_name": c.get("agent_name"), "title": c.get("title")}

    if not chat_index:
        return []

    chat_ids = list(chat_index.keys())
    msgs = (
        await mongo_db["messages"]
        .find({"chat_id": {"$in": chat_ids}, "role": "tool"}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(length=limit)
    )

    out = []
    for m in msgs:
        entry = {
            "chat": chat_index.get(m.get("chat_id"), {}),
            "tool_name": m.get("tool_name") or m.get("name"),
            "status": m.get("status") or "ok",
            "created_at": _serialize(m.get("created_at")),
            "args": _serialize(m.get("args") or m.get("tool_args")),
            "result_preview": (m.get("content") or "")[:320],
        }
        out.append(entry)
    return out

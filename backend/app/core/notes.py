"""Chat notes — per-chat note-taking with timestamps.

Users can save notes on any chat. Notes are displayed in a sidebar tab
and can be referenced by the agent via the /docs command.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.mongo import mongo_db

COLLECTION = "chat_notes"


async def ensure_indexes() -> None:
    try:
        await mongo_db[COLLECTION].create_index([("chat_id", 1), ("created_at", -1)])
    except Exception:
        pass


async def create_note(chat_id: str, content: str, user_email: str) -> dict:
    doc = {
        "chat_id": chat_id,
        "content": content,
        "created_by": user_email,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await mongo_db[COLLECTION].insert_one(doc)
    return {
        "id": str(result.inserted_id),
        "chat_id": chat_id,
        "content": content,
        "created_by": user_email,
        "created_at": doc["created_at"].isoformat(),
    }


async def list_notes(chat_id: str) -> list[dict]:
    cursor = mongo_db[COLLECTION].find(
        {"chat_id": chat_id}, {"_id": 0}
    ).sort("created_at", -1).limit(50)
    docs = await cursor.to_list(length=50)
    for d in docs:
        if hasattr(d.get("created_at"), "isoformat"):
            d["created_at"] = d["created_at"].isoformat()
        if hasattr(d.get("updated_at"), "isoformat"):
            d["updated_at"] = d["updated_at"].isoformat()
    return docs


async def delete_note(chat_id: str, note_content: str, user_email: str) -> bool:
    result = await mongo_db[COLLECTION].delete_one({
        "chat_id": chat_id,
        "content": note_content,
        "created_by": user_email,
    })
    return result.deleted_count > 0

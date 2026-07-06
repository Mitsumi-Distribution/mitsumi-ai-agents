from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo import DESCENDING

from app.core.mongo import mongo_db


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_str_id(document: dict[str, Any] | None) -> dict[str, Any] | None:
    if not document:
        return None
    data = dict(document)
    if "_id" in data:
        data["id"] = str(data.pop("_id"))
    return data


class ChatRepository:
    def __init__(self) -> None:
        self.chats = mongo_db["chats"]
        self.messages = mongo_db["messages"]

    async def create_chat(self, *, user_id: str, agent_name: str, title: str = "New chat") -> dict[str, Any]:
        now = _utc_now()
        payload = {
            "user_id": user_id,
            "agent_name": agent_name,
            "title": title,
            "pinned": False,
            "last_message_preview": "",
            "message_count": 0,
            "created_at": now,
            "updated_at": now,
            "is_deleted": False,
        }
        result = await self.chats.insert_one(payload)
        payload["_id"] = result.inserted_id
        return _to_str_id(payload) or {}

    async def list_chats(self, *, user_id: str, agent_name: str, query: str | None = None) -> list[dict[str, Any]]:
        filt: dict[str, Any] = {"user_id": user_id, "agent_name": agent_name, "is_deleted": False}
        if query:
            filt["$or"] = [
                {"title": {"$regex": query, "$options": "i"}},
                {"last_message_preview": {"$regex": query, "$options": "i"}},
            ]

        cursor = self.chats.find(filt).sort([("pinned", DESCENDING), ("updated_at", DESCENDING)])
        items: list[dict[str, Any]] = []
        async for doc in cursor:
            parsed = _to_str_id(doc)
            if parsed:
                items.append(parsed)
        return items

    async def get_chat(self, *, chat_id: str, user_id: str) -> dict[str, Any] | None:
        if not ObjectId.is_valid(chat_id):
            return None
        doc = await self.chats.find_one({"_id": ObjectId(chat_id), "user_id": user_id, "is_deleted": False})
        return _to_str_id(doc)

    async def get_chat_for_agent(self, *, chat_id: str, user_id: str, agent_name: str) -> dict[str, Any] | None:
        if not ObjectId.is_valid(chat_id):
            return None
        doc = await self.chats.find_one(
            {"_id": ObjectId(chat_id), "user_id": user_id, "agent_name": agent_name, "is_deleted": False}
        )
        return _to_str_id(doc)

    async def append_message(
        self,
        *,
        chat_id: str,
        role: str,
        content: str,
        tool_events: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        now = _utc_now()
        payload = {
            "chat_id": chat_id,
            "role": role,
            "content": content,
            "tool_events": tool_events or [],
            "created_at": now,
        }
        result = await self.messages.insert_one(payload)
        payload["_id"] = result.inserted_id
        return _to_str_id(payload) or {}

    async def list_messages(self, *, chat_id: str) -> list[dict[str, Any]]:
        cursor = self.messages.find({"chat_id": chat_id}).sort([("created_at", 1)])
        items: list[dict[str, Any]] = []
        async for doc in cursor:
            parsed = _to_str_id(doc)
            if parsed:
                items.append(parsed)
        return items

    async def update_chat(
        self,
        *,
        chat_id: str,
        user_id: str,
        title: str | None = None,
        pinned: bool | None = None,
    ) -> dict[str, Any] | None:
        if not ObjectId.is_valid(chat_id):
            return None

        update_set: dict[str, Any] = {"updated_at": _utc_now()}
        if title is not None:
            update_set["title"] = title.strip() or "Untitled chat"
        if pinned is not None:
            update_set["pinned"] = bool(pinned)

        await self.chats.update_one(
            {"_id": ObjectId(chat_id), "user_id": user_id, "is_deleted": False},
            {"$set": update_set},
        )
        return await self.get_chat(chat_id=chat_id, user_id=user_id)

    async def mark_deleted(self, *, chat_id: str, user_id: str) -> bool:
        if not ObjectId.is_valid(chat_id):
            return False
        result = await self.chats.update_one(
            {"_id": ObjectId(chat_id), "user_id": user_id, "is_deleted": False},
            {"$set": {"is_deleted": True, "updated_at": _utc_now()}},
        )
        return result.modified_count > 0

    async def update_after_exchange(
        self,
        *,
        chat_id: str,
        user_id: str,
        assistant_preview: str,
        increment_by: int = 2,
    ) -> dict[str, Any] | None:
        if not ObjectId.is_valid(chat_id):
            return None

        await self.chats.update_one(
            {"_id": ObjectId(chat_id), "user_id": user_id, "is_deleted": False},
            {
                "$set": {
                    "updated_at": _utc_now(),
                    "last_message_preview": assistant_preview[:180],
                },
                "$inc": {"message_count": increment_by},
            },
        )
        return await self.get_chat(chat_id=chat_id, user_id=user_id)


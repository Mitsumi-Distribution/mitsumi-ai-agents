from __future__ import annotations

import asyncio
from typing import Any

from app.chats.repository import ChatRepository
from app.chats.titles import generate_chat_title
from app.core.ws import ws_manager


class ChatService:
    def __init__(self) -> None:
        self.repo = ChatRepository()

    async def create_chat(self, *, user_id: str, agent_name: str) -> dict[str, Any]:
        return await self.repo.create_chat(user_id=user_id, agent_name=agent_name)

    async def list_chats(self, *, user_id: str, agent_name: str, query: str | None) -> list[dict[str, Any]]:
        return await self.repo.list_chats(user_id=user_id, agent_name=agent_name, query=query)

    async def get_chat_with_messages(self, *, user_id: str, chat_id: str) -> dict[str, Any] | None:
        chat = await self.repo.get_chat(chat_id=chat_id, user_id=user_id)
        if not chat:
            return None
        messages = await self.repo.list_messages(chat_id=chat_id)
        chat["messages"] = messages
        return chat

    async def rename_or_pin(
        self, *, user_id: str, chat_id: str, title: str | None = None, pinned: bool | None = None
    ) -> dict[str, Any] | None:
        return await self.repo.update_chat(chat_id=chat_id, user_id=user_id, title=title, pinned=pinned)

    async def delete_chat(self, *, user_id: str, chat_id: str) -> bool:
        return await self.repo.mark_deleted(chat_id=chat_id, user_id=user_id)

    async def update_title_from_first_exchange(
        self,
        *,
        user_id: str,
        chat_id: str,
        user_text: str,
        assistant_text: str,
    ) -> None:
        title = await generate_chat_title(user_text=user_text, assistant_text=assistant_text)
        updated = await self.repo.update_chat(chat_id=chat_id, user_id=user_id, title=title)
        if updated:
            await ws_manager.broadcast_to_user(
                user_id,
                {"type": "title", "chat_id": chat_id, "value": updated.get("title", title)},
            )

    def schedule_title_update(self, *, user_id: str, chat_id: str, user_text: str, assistant_text: str) -> None:
        if not user_text.strip() or not assistant_text.strip():
            return
        asyncio.create_task(
            self.update_title_from_first_exchange(
                user_id=user_id,
                chat_id=chat_id,
                user_text=user_text,
                assistant_text=assistant_text,
            )
        )


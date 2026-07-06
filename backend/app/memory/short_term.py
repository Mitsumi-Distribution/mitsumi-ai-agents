"""Short-term memory backed by Redis with auto-summarisation.

When the conversation exceeds MAX_MESSAGES, older messages are summarised
into a compact preamble so the agent always has context without blowing
the token budget.
"""

import json
from typing import Any

from redis.asyncio import from_url
from redis.exceptions import RedisError

from app.core.config import settings

redis_client = from_url(settings.REDIS_URL, decode_responses=True)

MAX_MESSAGES = max(settings.REDIS_MEMORY_MAX_MESSAGES, 40)  # keep more history
SUMMARY_TRIGGER = 30   # summarise when we reach this count
KEEP_RECENT = 16       # keep the last N messages verbatim after summarise


def build_session_key(session_id: str) -> str:
    return f"session:{session_id}:messages"


def build_summary_key(session_id: str) -> str:
    return f"session:{session_id}:summary"


async def get_short_term_memory(session_id: str) -> list[dict[str, Any]]:
    try:
        data = await redis_client.get(build_session_key(session_id))
        if not data:
            return []
        return json.loads(data)
    except (RedisError, OSError, ValueError, TypeError):
        return []


async def get_conversation_summary(session_id: str) -> str:
    """Return a summary preamble for the conversation, if one exists."""
    try:
        return (await redis_client.get(build_summary_key(session_id))) or ""
    except (RedisError, OSError):
        return ""


async def set_conversation_summary(session_id: str, summary: str) -> None:
    try:
        await redis_client.set(build_summary_key(session_id), summary, ex=settings.REDIS_TTL_SECONDS)
    except (RedisError, OSError):
        pass


async def append_short_term_memory(session_id: str, message: dict[str, Any]) -> None:
    messages = await get_short_term_memory(session_id)
    messages.append(message)
    capped = messages[-MAX_MESSAGES:]
    try:
        await redis_client.set(build_session_key(session_id), json.dumps(capped), ex=settings.REDIS_TTL_SECONDS)
    except (RedisError, OSError, ValueError, TypeError):
        return


async def set_short_term_memory(session_id: str, messages: list[dict[str, Any]]) -> None:
    capped = messages[-MAX_MESSAGES:]
    try:
        await redis_client.set(build_session_key(session_id), json.dumps(capped), ex=settings.REDIS_TTL_SECONDS)
    except (RedisError, OSError, ValueError, TypeError):
        return


async def auto_summarise_if_needed(session_id: str) -> None:
    """If messages exceed SUMMARY_TRIGGER, compress old ones into a summary."""
    messages = await get_short_term_memory(session_id)
    if len(messages) < SUMMARY_TRIGGER:
        return
    # Split: old messages to summarise + recent to keep
    old = messages[:-KEEP_RECENT]
    recent = messages[-KEEP_RECENT:]
    # Build a quick summary from old messages
    existing_summary = await get_conversation_summary(session_id)
    summary_parts = []
    if existing_summary:
        summary_parts.append(existing_summary)
    for msg in old:
        role = msg.get("role", "?")
        content = msg.get("content", "")
        if content.strip():
            # Truncate long messages to 200 chars for the summary
            summary_parts.append(f"{role}: {content[:200]}")
    new_summary = "\n".join(summary_parts)
    # Cap summary at ~3000 chars
    if len(new_summary) > 3000:
        new_summary = new_summary[-3000:]
    await set_conversation_summary(session_id, new_summary)
    await set_short_term_memory(session_id, recent)

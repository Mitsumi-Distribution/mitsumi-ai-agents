from __future__ import annotations

from app.agents.base import get_llm


TITLE_SYSTEM_PROMPT = (
    "Generate a concise conversation title between 3 and 6 words. "
    "Use sentence case, avoid punctuation, and return only the title text."
)


async def generate_chat_title(*, user_text: str, assistant_text: str) -> str:
    source = f"User: {user_text.strip()}\nAssistant: {assistant_text.strip()}"
    fallback = (user_text.strip() or "New chat")[:48]
    if not source.strip():
        return "New chat"

    try:
        llm = get_llm()
        message = (
            f"{TITLE_SYSTEM_PROMPT}\n\n"
            f"Conversation excerpt:\n{source[:1200]}\n\n"
            "Title:"
        )
        result = await llm.ainvoke(message)
        raw = getattr(result, "content", "") if result is not None else ""
        title = str(raw).strip().replace("\n", " ")
        if not title:
            return fallback or "New chat"
        cleaned = title.strip("\"' ")
        return (cleaned or fallback or "New chat")[:72]
    except Exception:
        return fallback or "New chat"


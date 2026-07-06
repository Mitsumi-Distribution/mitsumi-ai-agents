"""Detect teammate @mentions inside an assistant reply and notify them.

Rules:
    - We look for both literal email addresses (`alice@example.com`) and
      `@name` handles that match a known user's display name (case-insensitive).
    - We only notify users who (a) exist, (b) are not the author, and (c)
      have module access to the agent where the mention happened.
    - Best-effort — any error swallowed so the chat stream is never blocked.
"""

from __future__ import annotations

import logging
import re
from typing import Iterable

from app.core.mongo import mongo_db, user_has_module
from app.core.notifications import notify

log = logging.getLogger("mentions")

_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_HANDLE_RE = re.compile(r"(?:^|\s)@([A-Za-z][A-Za-z0-9_.-]{1,40})")


def _extract_candidates(text: str) -> tuple[set[str], set[str]]:
    """Return (lowercased emails, lowercased handles)."""
    emails = {m.group(0).lower() for m in _EMAIL_RE.finditer(text)}
    handles = {m.group(1).lower() for m in _HANDLE_RE.finditer(text)}
    return emails, handles


async def _resolve_users(emails: set[str], handles: set[str]) -> list[dict]:
    """Look up known users matching any of the candidates."""
    if not emails and not handles:
        return []
    filters: list[dict] = []
    if emails:
        filters.append({"email": {"$in": list(emails)}})
    if handles:
        # Match on the lowercase of the handle as a substring of `name`.
        handle_regexes = [re.compile(re.escape(h), re.IGNORECASE) for h in handles]
        filters.append({"name": {"$in": [r.pattern for r in handle_regexes]}})
    # Union, de-duplicate on email.
    seen: dict[str, dict] = {}
    for filt in filters:
        cursor = mongo_db["users"].find(
            filt, {"_id": 0, "email": 1, "name": 1, "modules": 1, "roles": 1, "is_super_admin": 1}
        )
        async for doc in cursor:
            email = (doc.get("email") or "").lower()
            if not email:
                continue
            if email not in seen:
                seen[email] = doc
    return list(seen.values())


async def notify_mentions(
    *,
    author_email: str,
    agent_name: str,
    chat_id: str,
    text: str,
) -> list[str]:
    """Scan `text` for teammate mentions and drop a notification per unique
    user hit. Returns the list of notified emails (handy for tests).
    """
    try:
        emails, handles = _extract_candidates(text or "")
        if not emails and not handles:
            return []
        users = await _resolve_users(emails, handles)
        notified: list[str] = []
        author_lower = (author_email or "").lower()
        for u in users:
            email = u["email"].lower()
            if email == author_lower:
                continue
            if not (u.get("is_super_admin") or user_has_module(u, f"agent:{agent_name}") or user_has_module(u, f"department:{agent_name}")):
                # Don't notify users who can't even visit the chat.
                continue
            await notify(
                recipient_email=email,
                kind="task",
                title=f"You were mentioned in a {agent_name.capitalize()} chat",
                body=(text.strip() or "")[:200],
                link=f"/agent/{agent_name}/c/{chat_id}",
                metadata={"agent": agent_name, "chat_id": chat_id, "by": author_email},
            )
            notified.append(email)
        return notified
    except Exception as exc:  # pragma: no cover
        log.warning("mention notify failed: %s", exc)
        return []

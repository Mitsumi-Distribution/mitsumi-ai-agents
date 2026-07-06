"""In-app notifications.

A tiny service for "you have mail" style notifications. Notifications are
per-recipient; each row stores `recipient_email` so the API can scope by
the calling user. The arq worker and a few other subsystems call
``notify()`` to drop a new row into Mongo — the frontend polls
``GET /api/notifications`` (paginated) or watches the bell badge via
``GET /api/notifications/unread-count``.

Kinds (for the UI icon):
    "job"       — an agent job finished / failed
    "task"      — a task was created or updated
    "user"      — a teammate was invited or their role changed
    "system"    — region deleted, key rotated, etc.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.core.mongo import mongo_db

log = logging.getLogger("notifications")

VALID_KINDS = {"job", "task", "user", "system"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def ensure_indexes() -> None:
    try:
        await mongo_db["notifications"].create_index(
            [("recipient_email", 1), ("created_at", -1)]
        )
        await mongo_db["notifications"].create_index(
            [("recipient_email", 1), ("read", 1)]
        )
    except Exception as exc:  # pragma: no cover
        log.warning("notifications index setup failed: %s", exc)


async def notify(
    *,
    recipient_email: str,
    kind: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
    metadata: dict | None = None,
) -> dict | None:
    """Insert a new notification and publish a real-time event.

    The Redis pub/sub publish is best-effort: if the worker process or the
    web process (whichever is calling us) can't reach Redis, the row is
    still written so the next bell-open / notifications page fetch will
    pick it up.
    """
    if not recipient_email:
        return None
    if kind not in VALID_KINDS:
        kind = "system"
    doc = {
        "recipient_email": recipient_email.lower(),
        "kind": kind,
        "title": title,
        "body": body or "",
        "link": link or None,
        "metadata": metadata or {},
        "read": False,
        "created_at": _now(),
    }
    try:
        result = await mongo_db["notifications"].insert_one(doc)
        doc["_id"] = result.inserted_id
        serialized = _serialize(doc)
    except Exception as exc:  # pragma: no cover
        log.warning("notification write failed for %s: %s", recipient_email, exc)
        return None

    try:
        from app.core.events import publish as publish_event
        unread = await unread_count(recipient_email)
        await publish_event(
            recipient_email.lower(),
            {"type": "notification", "notification": serialized, "unread": unread},
        )
    except Exception as exc:  # pragma: no cover
        log.debug("notification publish failed: %s", exc)

    return serialized


def _serialize(doc: dict) -> dict:
    created = doc.get("created_at")
    return {
        "id": str(doc["_id"]),
        "recipient_email": doc.get("recipient_email"),
        "kind": doc.get("kind", "system"),
        "title": doc.get("title", ""),
        "body": doc.get("body") or "",
        "link": doc.get("link"),
        "metadata": doc.get("metadata") or {},
        "read": bool(doc.get("read")),
        "created_at": created.isoformat() if isinstance(created, datetime) else created,
    }


async def list_for_user(
    email: str,
    *,
    skip: int = 0,
    limit: int = 20,
    unread_only: bool = False,
    kind: str | None = None,
) -> dict:
    filt: dict[str, Any] = {"recipient_email": email.lower()}
    if unread_only:
        filt["read"] = False
    if kind and kind in VALID_KINDS:
        filt["kind"] = kind
    cursor = (
        mongo_db["notifications"]
        .find(filt, {"_id": 1, "recipient_email": 1, "kind": 1, "title": 1, "body": 1, "link": 1, "metadata": 1, "read": 1, "created_at": 1})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    total = await mongo_db["notifications"].count_documents(filt)
    unread = await mongo_db["notifications"].count_documents(
        {"recipient_email": email.lower(), "read": False}
    )
    return {
        "items": [_serialize(d) for d in docs],
        "total": total,
        "unread": unread,
        "skip": skip,
        "limit": limit,
    }


async def unread_count(email: str) -> int:
    return await mongo_db["notifications"].count_documents(
        {"recipient_email": email.lower(), "read": False}
    )


async def mark_read(email: str, notification_id: str) -> bool:
    from bson import ObjectId

    if not ObjectId.is_valid(notification_id):
        return False
    res = await mongo_db["notifications"].update_one(
        {"_id": ObjectId(notification_id), "recipient_email": email.lower()},
        {"$set": {"read": True}},
    )
    return bool(res.matched_count)


async def mark_all_read(email: str) -> int:
    res = await mongo_db["notifications"].update_many(
        {"recipient_email": email.lower(), "read": False}, {"$set": {"read": True}}
    )
    return int(res.modified_count)


async def delete(email: str, notification_id: str) -> bool:
    from bson import ObjectId

    if not ObjectId.is_valid(notification_id):
        return False
    res = await mongo_db["notifications"].delete_one(
        {"_id": ObjectId(notification_id), "recipient_email": email.lower()}
    )
    return bool(res.deleted_count)

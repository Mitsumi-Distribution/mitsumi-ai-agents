"""Lightweight audit log helpers.

Writes compact events to the `audit_logs` collection so Settings → Audit Log
can render a chronological trail. Non-blocking failures are swallowed so a
logging hiccup never takes down the underlying request.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.core.mongo import mongo_db

log = logging.getLogger("audit")

# Canonical action names used by the UI to group / colour events.
ACTIONS = {
    "user.invite",
    "user.update",
    "user.delete",
    "user.password_set",
    "preferences.update",
    "department.scope_override",
}


async def record(
    action: str,
    *,
    actor: dict | str | None,
    target: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    try:
        if isinstance(actor, dict):
            actor_email = actor.get("email")
            actor_name = actor.get("name") or actor_email
            actor_roles = actor.get("roles") or []
        elif isinstance(actor, str):
            actor_email = actor
            actor_name = actor
            actor_roles = []
        else:
            actor_email = None
            actor_name = "system"
            actor_roles = []

        doc = {
            "action": action,
            "actor_email": actor_email,
            "actor_name": actor_name,
            "actor_roles": actor_roles,
            "target": target,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc),
        }
        await mongo_db["audit_logs"].insert_one(doc)
    except Exception as exc:  # pragma: no cover — logging must never fail the request
        log.warning("audit log write failed: %s", exc)


async def ensure_indexes() -> None:
    try:
        await mongo_db["audit_logs"].create_index([("created_at", -1)])
        await mongo_db["audit_logs"].create_index("actor_email")
        await mongo_db["audit_logs"].create_index("action")
    except Exception as exc:  # pragma: no cover
        log.warning("audit index creation failed: %s", exc)

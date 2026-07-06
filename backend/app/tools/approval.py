"""Approval workflow tool — agents can route decisions to managers."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from langchain_core.tools import tool
from app.core.mongo import mongo_db

COLLECTION = "approvals"


@tool
async def request_approval(
    title: str,
    description: str,
    department: str = "",
    approver_email: str = "",
    amount: float = 0,
    category: str = "general",
) -> str:
    """Submit an approval request. Categories: credit_hold, deal_registration,
    pricing_exception, budget, general. The request appears in the approvals
    dashboard and the approver gets a notification."""
    doc = {
        "title": title,
        "description": description,
        "department": department,
        "approver_email": approver_email,
        "amount": amount,
        "category": category,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await mongo_db[COLLECTION].insert_one(doc)
    approval_id = str(result.inserted_id)

    # Send notification to approver if email provided
    if approver_email:
        try:
            from app.core.notifications import notify
            await notify(
                recipient_email=approver_email,
                kind="task",
                title=f"Approval needed: {title}",
                body=f"{category.replace('_', ' ').title()} — {description[:100]}",
                link=f"/tasks?tab=jobs",
                metadata={"approval_id": approval_id},
            )
        except Exception:
            pass

    return json.dumps({
        "submitted": True,
        "approval_id": approval_id,
        "title": title,
        "category": category,
        "status": "pending",
        "approver": approver_email or "(unassigned)",
        "note": f"Approval request submitted. {('Notification sent to ' + approver_email) if approver_email else 'Assign an approver to notify them.'}",
    })

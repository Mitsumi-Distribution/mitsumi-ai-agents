"""Advanced orchestration tools for agents.

schedule_meeting  — Create a meeting/event with attendees and agenda
data_comparison   — Compare metrics across periods, regions, or products
task_creator      — Agent can create tasks from within a chat
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from langchain_core.tools import tool

from app.core.mongo import mongo_db


@tool
async def schedule_meeting(
    title: str,
    date: str,
    time: str,
    duration_minutes: int = 60,
    attendees: str = "",
    agenda: str = "",
    department: str = "",
) -> str:
    """Schedule a meeting. If Google Calendar is connected, creates a real
    Google Calendar event with a Google Meet link and sends invites automatically.
    Otherwise saves locally and emails invites via Resend.
    Date: YYYY-MM-DD, Time: HH:MM. Attendees: comma-separated emails."""
    from app.core.config import settings

    attendee_list = [a.strip() for a in attendees.split(",") if a.strip()]

    # Try Google Calendar first
    try:
        from app.tools.google_tools import _get_creds
        creds = await _get_creds()
        if creds:
            from googleapiclient.discovery import build
            service = build("calendar", "v3", credentials=creds)
            start_dt = f"{date}T{time}:00"
            h, m = int(time.split(":")[0]), int(time.split(":")[1])
            total_min = h * 60 + m + duration_minutes
            end_dt = f"{date}T{total_min // 60:02d}:{total_min % 60:02d}:00"
            event_body = {
                "summary": title,
                "description": f"Department: {department}\n\nAgenda:\n{agenda}",
            "start": {"dateTime": start_dt, "timeZone": settings.GOOGLE_CALENDAR_TIMEZONE},
            "end": {"dateTime": end_dt, "timeZone": settings.GOOGLE_CALENDAR_TIMEZONE},
                "conferenceData": {"createRequest": {"requestId": f"mt-{date}-{time.replace(':','')}",
                    "conferenceSolutionKey": {"type": "hangoutsMeet"}}},
            }
            if attendee_list:
                event_body["attendees"] = [{"email": e} for e in attendee_list]
            event = service.events().insert(calendarId="primary", body=event_body,
                sendUpdates="all", conferenceDataVersion=1).execute()
            meet_link = ""
            for ep in (event.get("conferenceData", {}).get("entryPoints") or []):
                if ep.get("entryPointType") == "video":
                    meet_link = ep.get("uri", "")
                    break
            return json.dumps({
                "scheduled": True, "provider": "google_calendar",
                "event_id": event.get("id"), "calendar_link": event.get("htmlLink", ""),
                "meet_link": meet_link, "title": title, "date": date, "time": time,
                "duration": f"{duration_minutes} min", "attendees": attendee_list,
                "invites_sent": len(attendee_list),
                "note": f"Google Calendar event created{' with Google Meet link' if meet_link else ''}. {len(attendee_list)} invite(s) sent.",
            }, default=str)
    except Exception:
        pass

    # Google not connected — return action_required so the UI shows "Connect Google" button
    return json.dumps({
        "scheduled": False,
        "error": "Google Calendar not connected",
        "action_required": "google_connect",
        "action_label": "Connect Google Calendar",
        "action_url": "/settings",
        "message": "To schedule meetings with Google Meet links, connect your Google account in Settings.",
        "title": title, "date": date, "time": time,
        "attendees": attendee_list,
    }, default=str)


@tool
async def data_comparison(
    metric: str,
    dimension: str = "region",
    period: str = "current",
) -> str:
    """Compare business metrics across dimensions. Useful for period-over-period,
    region-vs-region, or product-vs-product analysis.
    metric: revenue, pipeline, invoices, tickets, deals
    dimension: region, country, principal, stage, status
    period: current, all"""
    results = {}

    if metric in ("revenue", "pipeline", "deals"):
        pipeline = await mongo_db["crm_leads"].aggregate([
            {"$group": {
                "_id": f"${dimension}" if dimension != "principal" else "$principal",
                "count": {"$sum": 1},
                "total_value": {"$sum": "$amount"},
                "weighted": {"$sum": {"$multiply": ["$amount", {"$ifNull": ["$probability", 0]}]}},
            }},
            {"$sort": {"total_value": -1}},
        ]).to_list(length=20)
        results = {
            "metric": metric,
            "dimension": dimension,
            "data": [
                {dimension: r["_id"], "deals": r["count"],
                 "total_value": r["total_value"], "weighted": round(r["weighted"], 2)}
                for r in pipeline
            ],
        }

    elif metric == "invoices":
        pipeline = await mongo_db["finance_invoices"].aggregate([
            {"$group": {
                "_id": f"${dimension}" if dimension in ("status", "region", "country") else "$customer_name",
                "count": {"$sum": 1},
                "total": {"$sum": "$amount"},
            }},
            {"$sort": {"total": -1}},
        ]).to_list(length=20)
        results = {
            "metric": "invoices",
            "dimension": dimension,
            "data": [{dimension: r["_id"], "count": r["count"], "total": r["total"]} for r in pipeline],
        }

    elif metric == "tickets":
        pipeline = await mongo_db["ops_tickets"].aggregate([
            {"$group": {
                "_id": f"${dimension}" if dimension in ("priority", "status", "region") else "$customer_name",
                "count": {"$sum": 1},
            }},
            {"$sort": {"count": -1}},
        ]).to_list(length=20)
        results = {
            "metric": "tickets",
            "dimension": dimension,
            "data": [{dimension: r["_id"], "count": r["count"]} for r in pipeline],
        }
    else:
        return json.dumps({"error": f"Unknown metric: {metric}. Use: revenue, pipeline, deals, invoices, tickets"})

    return json.dumps(results, default=str)


@tool
async def task_creator(
    title: str,
    department: str = "",
    priority: str = "medium",
    agent_prompt: str = "",
    created_by: str = "agent",
) -> str:
    """Create a new task from within a chat conversation. The task will appear
    in the Tasks page and can optionally be run by an agent later."""
    doc = {
        "title": title,
        "department": department or None,
        "priority": priority,
        "status": "todo",
        "agent_prompt": agent_prompt,
        "tools": [],
        "created_by": created_by,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await mongo_db["tasks"].insert_one(doc)
    return json.dumps({
        "created": True,
        "task_id": str(result.inserted_id),
        "title": title,
        "department": department,
        "priority": priority,
        "note": "Task created and visible in the Tasks page.",
    })

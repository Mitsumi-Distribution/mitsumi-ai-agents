"""Google Calendar + Gmail tools using OAuth2 tokens.

These tools use the stored Google OAuth tokens to interact with
the user's real Google Calendar and Gmail accounts.
"""

from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from email.mime.text import MIMEText

from langchain_core.tools import tool


# The current user email is set per-request by the WS handler
import contextvars
_user_email_var: contextvars.ContextVar[str] = contextvars.ContextVar("google_user_email", default="")


def set_google_user_email(email: str) -> None:
    _user_email_var.set(email)


async def _get_creds():
    """Get Google credentials for the current user."""
    from app.routers.google_oauth import get_user_credentials
    email = _user_email_var.get("")
    if not email:
        return None
    return await get_user_credentials(email)


@tool
async def google_calendar_create(
    title: str,
    start_datetime: str,
    end_datetime: str,
    description: str = "",
    attendees: str = "",
    location: str = "",
) -> str:
    """Create a Google Calendar event. Requires Google account to be connected.
    start_datetime and end_datetime: ISO 8601 format (e.g., 2026-04-25T10:00:00).
    attendees: comma-separated email addresses."""
    creds = await _get_creds()
    if not creds:
        return json.dumps({
            "error": "Google account not connected",
            "connected": False,
            "action_required": "google_connect",
            "action_label": "Connect Google Account",
            "action_url": "/settings",
            "message": "To create Google Calendar events with Meet links, connect your Google account in Settings."
        })

    try:
        from googleapiclient.discovery import build
        service = build("calendar", "v3", credentials=creds)

        event_body = {
            "summary": title,
            "description": description,
            "location": location,
            "start": {"dateTime": start_datetime, "timeZone": settings.GOOGLE_CALENDAR_TIMEZONE},
            "end": {"dateTime": end_datetime, "timeZone": settings.GOOGLE_CALENDAR_TIMEZONE},
        }
        if attendees:
            event_body["attendees"] = [{"email": e.strip()} for e in attendees.split(",") if e.strip()]

        event = service.events().insert(calendarId="primary", body=event_body, sendUpdates="all").execute()

        return json.dumps({
            "created": True,
            "event_id": event.get("id"),
            "html_link": event.get("htmlLink"),
            "title": title,
            "start": start_datetime,
            "end": end_datetime,
            "attendees": [a["email"] for a in event.get("attendees", [])],
        })
    except Exception as exc:
        return json.dumps({"error": str(exc)[:200], "connected": True})


@tool
async def google_calendar_list(days_ahead: int = 7) -> str:
    """List upcoming Google Calendar events for the next N days.
    Requires Google account to be connected."""
    creds = await _get_creds()
    if not creds:
        return json.dumps({"error": "Google account not connected", "connected": False,
            "action_required": "google_connect", "action_label": "Connect Google",
            "action_url": "/settings", "message": "Connect your Google account in Settings to view calendar events."})

    try:
        from googleapiclient.discovery import build
        service = build("calendar", "v3", credentials=creds)

        now = datetime.now(timezone.utc).isoformat()
        from datetime import timedelta
        end = (datetime.now(timezone.utc) + timedelta(days=days_ahead)).isoformat()

        result = service.events().list(
            calendarId="primary",
            timeMin=now,
            timeMax=end,
            maxResults=20,
            singleEvents=True,
            orderBy="startTime",
        ).execute()

        events = []
        for e in result.get("items", []):
            events.append({
                "title": e.get("summary", "No title"),
                "start": e.get("start", {}).get("dateTime") or e.get("start", {}).get("date"),
                "end": e.get("end", {}).get("dateTime") or e.get("end", {}).get("date"),
                "attendees": [a.get("email") for a in e.get("attendees", [])],
                "location": e.get("location", ""),
                "link": e.get("htmlLink", ""),
            })

        return json.dumps({"events": events, "count": len(events), "days_ahead": days_ahead})
    except Exception as exc:
        return json.dumps({"error": str(exc)[:200]})


@tool
async def gmail_send(
    to: str,
    subject: str,
    body: str,
) -> str:
    """Send an email via the user's Gmail account. Requires Google account connected.
    Use this for personal emails. For bulk/system emails, use send_email (Resend) instead."""
    creds = await _get_creds()
    if not creds:
        return json.dumps({"error": "Google account not connected", "connected": False,
            "action_required": "google_connect", "action_label": "Connect Gmail",
            "action_url": "/settings", "message": "Connect your Google account in Settings to send emails via Gmail."})

    try:
        from googleapiclient.discovery import build
        service = build("gmail", "v1", credentials=creds)

        message = MIMEText(body)
        message["to"] = to
        message["subject"] = subject
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

        result = service.users().messages().send(
            userId="me",
            body={"raw": raw},
        ).execute()

        return json.dumps({
            "sent": True,
            "message_id": result.get("id"),
            "to": to,
            "subject": subject,
            "provider": "gmail",
        })
    except Exception as exc:
        return json.dumps({"error": str(exc)[:200]})


@tool
async def gmail_read(query: str = "is:unread", max_results: int = 10) -> str:
    """Read emails from the user's Gmail inbox. Use Gmail search syntax for query.
    Examples: 'is:unread', 'from:boss@company.com', 'subject:pipeline report'.
    Requires Google account connected."""
    creds = await _get_creds()
    if not creds:
        return json.dumps({"error": "Google account not connected", "connected": False,
            "action_required": "google_connect", "action_label": "Connect Gmail",
            "action_url": "/settings", "message": "Connect your Google account in Settings to read Gmail."})

    try:
        from googleapiclient.discovery import build
        service = build("gmail", "v1", credentials=creds)

        result = service.users().messages().list(
            userId="me",
            q=query,
            maxResults=min(max_results, 20),
        ).execute()

        messages = []
        for msg_ref in result.get("messages", [])[:max_results]:
            msg = service.users().messages().get(
                userId="me",
                id=msg_ref["id"],
                format="metadata",
                metadataHeaders=["From", "To", "Subject", "Date"],
            ).execute()

            headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
            messages.append({
                "id": msg["id"],
                "from": headers.get("From", ""),
                "to": headers.get("To", ""),
                "subject": headers.get("Subject", ""),
                "date": headers.get("Date", ""),
                "snippet": msg.get("snippet", "")[:200],
                "unread": "UNREAD" in msg.get("labelIds", []),
            })

        return json.dumps({"emails": messages, "count": len(messages), "query": query})
    except Exception as exc:
        return json.dumps({"error": str(exc)[:200]})

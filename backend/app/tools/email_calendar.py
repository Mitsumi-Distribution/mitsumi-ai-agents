"""Email + calendar tools.

`send_email` uses Resend when `RESEND_API_KEY` is set, with optional file
attachments (PDF, Excel). Falls back to `generated/email_log.jsonl` in dev.

`calendar_event` uses a Google service account when configured, otherwise
persists to `generated/calendar_events.json`.
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from langchain_core.tools import tool

from app.core.config import settings

EMAIL_LOG_PATH = Path("generated/email_log.jsonl")
CALENDAR_PATH = Path("generated/calendar_events.json")
GENERATED_DIR = Path("generated")


def _markdown_to_html(text: str) -> str:
    """Convert markdown text to email-safe HTML with Quicksand font."""
    import re
    lines = text.split("\n")
    html_parts: list[str] = []
    in_list = False
    list_type = ""
    in_table = False
    table_rows: list[list[str]] = []
    table_headers: list[str] = []
    F = "font-family:'Quicksand','Segoe UI',sans-serif"

    def flush_table():
        nonlocal in_table, table_rows, table_headers
        if not in_table:
            return
        in_table = False
        html_parts.append(
            f'<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:12px 0;border-radius:8px;overflow:hidden;">'
        )
        if table_headers:
            html_parts.append("<tr>")
            for h in table_headers:
                html_parts.append(
                    f'<td style="background:#4F6AF5;color:#fff;{F};font-size:12px;font-weight:600;padding:8px 12px;">{_inline_md(h)}</td>'
                )
            html_parts.append("</tr>")
        for ri, row in enumerate(table_rows):
            bg = "#f8fafc" if ri % 2 == 1 else "#ffffff"
            html_parts.append("<tr>")
            for cell in row:
                html_parts.append(
                    f'<td style="background:{bg};{F};font-size:12px;padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#334155;">{_inline_md(cell)}</td>'
                )
            html_parts.append("</tr>")
        html_parts.append("</table>")
        table_rows = []
        table_headers = []

    for line in lines:
        stripped = line.strip()

        # Close list if leaving list context
        if in_list and not stripped.startswith("- ") and not stripped.startswith("* ") and not re.match(r"^\d+\.\s", stripped):
            html_parts.append(f"</{list_type}>")
            in_list = False

        # Table detection
        if "|" in stripped and stripped.count("|") >= 2:
            cells = [c.strip() for c in stripped.split("|") if c.strip()]
            if all(set(c) <= set("-: ") for c in cells):
                continue  # separator row
            if not in_table:
                flush_table()
                in_table = True
                table_headers = cells
            else:
                table_rows.append(cells)
            continue
        elif in_table:
            flush_table()

        if not stripped:
            if not in_list:
                html_parts.append("<br>")
            continue

        # Headings
        h_match = re.match(r"^(#{1,3})\s+(.+)", stripped)
        if h_match:
            level = len(h_match.group(1))
            sizes = {1: "18px", 2: "16px", 3: "14px"}
            html_parts.append(
                f'<h{level} style="{F};font-size:{sizes.get(level,"14px")};font-weight:700;'
                f'color:#0B0F19;margin:16px 0 8px 0;">{_inline_md(h_match.group(2))}</h{level}>'
            )
            continue

        if re.match(r"^[-_*]{3,}\s*$", stripped):
            html_parts.append(f'<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">')
            continue

        # Unordered list
        if stripped.startswith("- ") or stripped.startswith("* "):
            if not in_list or list_type != "ul":
                if in_list:
                    html_parts.append(f"</{list_type}>")
                html_parts.append(f'<ul style="margin:8px 0;padding-left:20px;{F};font-size:14px;color:#334155;">')
                in_list = True
                list_type = "ul"
            content = re.sub(r"^[-*]\s+", "", stripped)
            html_parts.append(f'<li style="margin:4px 0;">{_inline_md(content)}</li>')
            continue

        # Ordered list
        ol_match = re.match(r"^(\d+)\.\s+(.+)", stripped)
        if ol_match:
            if not in_list or list_type != "ol":
                if in_list:
                    html_parts.append(f"</{list_type}>")
                html_parts.append(f'<ol style="margin:8px 0;padding-left:20px;{F};font-size:14px;color:#334155;">')
                in_list = True
                list_type = "ol"
            html_parts.append(f'<li style="margin:4px 0;">{_inline_md(ol_match.group(2))}</li>')
            continue

        # Paragraph
        html_parts.append(f'<p style="margin:8px 0;{F};font-size:14px;color:#334155;">{_inline_md(stripped)}</p>')

    if in_list:
        html_parts.append(f"</{list_type}>")
    flush_table()

    return "\n".join(html_parts)


def _inline_md(text: str) -> str:
    """Convert inline markdown (**bold**, *italic*, `code`) to HTML."""
    import re
    # Bold
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    # Italic
    text = re.sub(r"\*(.+?)\*", r"<em>\1</em>", text)
    # Code
    text = re.sub(
        r"`([^`]+)`",
        r'<code style="background: #F1F5F9; padding: 1px 6px; border-radius: 4px; font-size: 13px; font-family: monospace;">\1</code>',
        text,
    )
    # Checkmarks (✓ ✅)
    text = text.replace("✓", "&#10003;").replace("✅", "&#9989;")
    return text


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _resolve_attachment(file_path: str) -> dict | None:
    """Resolve a file path to a Resend attachment dict {filename, content (b64)}."""
    # Try relative to generated/ or absolute
    candidates = [
        Path(file_path),
        GENERATED_DIR / file_path,
        GENERATED_DIR / Path(file_path).name,
    ]
    for p in candidates:
        if p.exists() and p.is_file():
            content = base64.b64encode(p.read_bytes()).decode("utf-8")
            return {"filename": p.name, "content": content}
    return None


async def _resend_send(to: str, subject: str, body: str, attachments: list[str] | None = None) -> dict:
    """Non-blocking Resend HTTP send with optional attachments."""
    import resend

    resend.api_key = settings.RESEND_API_KEY

    # Convert markdown body to proper HTML
    html_body = _markdown_to_html(body)
    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
</head><body style="margin:0;padding:0;background:#f8fafc;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#4F6AF5 0%,#3B52CC 100%);padding:24px 32px;">
    <table width="100%"><tr>
      <td><img src="https://res.cloudinary.com/dunssu2gi/image/upload/v1767612787/blog-images/tfvwseshobpnx7blnimx.png" alt="Mitsumi" height="32" style="display:block;"></td>
      <td align="right" style="font-family:'Quicksand',sans-serif;font-size:11px;color:rgba(255,255,255,0.7);">Mitsumi Distribution</td>
    </tr></table>
  </td></tr>
  <!-- Subject bar -->
  <tr><td style="padding:20px 32px 0;font-family:'Quicksand',sans-serif;font-size:18px;font-weight:700;color:#0B0F19;">{subject}</td></tr>
  <!-- Body -->
  <tr><td style="padding:16px 32px 28px;font-family:'Quicksand','Segoe UI',sans-serif;font-size:14px;line-height:1.7;color:#334155;">
    {html_body}
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
    <table width="100%"><tr>
      <td style="font-family:'Quicksand',sans-serif;font-size:11px;color:#94a3b8;">Mitsumi Distribution &middot; East Africa & UAE</td>
      <td align="right" style="font-family:'Quicksand',sans-serif;font-size:11px;"><a href="https://mitsumidistribution.com" style="color:#4F6AF5;text-decoration:none;">mitsumidistribution.com</a></td>
    </tr></table>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""

    params: dict = {
        "from": f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>",
        "to": [to],
        "subject": subject,
        "text": body,
        "html": html,
        "reply_to": settings.EMAIL_REPLY_TO,
    }

    # Attach files
    if attachments:
        att_list = []
        for fp in attachments:
            att = _resolve_attachment(fp)
            if att:
                att_list.append(att)
        if att_list:
            params["attachments"] = att_list

    result = await asyncio.to_thread(resend.Emails.send, params)
    return {
        "delivered": True,
        "provider": "resend",
        "email_id": (result or {}).get("id"),
        "attachments_sent": len(params.get("attachments", [])),
    }


@tool
async def send_email(to: str, subject: str, body: str, attachments: str = "") -> str:
    """Send an email via Resend. Optionally attach files by passing a comma-separated
    list of file paths (e.g. 'generated/report.pdf,generated/data.xlsx') in the
    attachments parameter. Files must exist in the generated/ folder."""
    att_list = [a.strip() for a in attachments.split(",") if a.strip()] if attachments else []

    payload = {
        "to": to,
        "subject": subject,
        "body": body,
        "attachments": att_list,
        "timestamp": _now_iso(),
    }

    if settings.RESEND_API_KEY:
        try:
            result = await _resend_send(to, subject, body, att_list or None)
            payload.update(result)
            payload["status"] = "sent"
        except Exception as exc:
            payload["status"] = "error"
            payload["error"] = str(exc)
            payload["delivered"] = False
            payload["provider"] = "resend"
    else:
        payload["status"] = "logged"
        payload["provider"] = "file-log"
        payload["delivered"] = False
        EMAIL_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with EMAIL_LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload) + "\n")

    return json.dumps(payload)


# ---------- calendar_event ------------------------------------------------

async def _google_calendar_insert(event_data: dict) -> dict:
    from googleapiclient.discovery import build
    from google.oauth2 import service_account

    info = json.loads(settings.GOOGLE_CALENDAR_JSON)
    credentials = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/calendar.events"]
    )

    def _insert() -> dict:
        service = build("calendar", "v3", credentials=credentials, cache_discovery=False)
        body = {
            "summary": event_data.get("title") or "Mitsumi AI event",
            "description": event_data.get("description") or "",
            "start": {"dateTime": event_data["start"], "timeZone": settings.GOOGLE_CALENDAR_TIMEZONE},
            "end": {"dateTime": event_data["end"], "timeZone": settings.GOOGLE_CALENDAR_TIMEZONE},
            "attendees": [{"email": e} for e in event_data.get("attendees", []) if e],
        }
        return service.events().insert(calendarId=settings.GOOGLE_CALENDAR_ID, body=body).execute()

    result = await asyncio.to_thread(_insert)
    return {"provider": "google", "delivered": True, "event_id": result.get("id"), "html_link": result.get("htmlLink")}


@tool
async def calendar_event(action: str, payload: str) -> str:
    """Create or list calendar events. action='list' or 'create'. For create,
    payload is JSON: {title, start, end, description?, attendees?}."""
    CALENDAR_PATH.parent.mkdir(parents=True, exist_ok=True)
    events: list[dict] = []
    if CALENDAR_PATH.exists():
        try:
            events = json.loads(CALENDAR_PATH.read_text(encoding="utf-8"))
        except Exception:
            events = []

    if action == "list":
        return json.dumps({"events": events[-20:]})

    if action == "create":
        try:
            event_data = json.loads(payload)
        except json.JSONDecodeError as exc:
            return json.dumps({"error": f"Invalid payload JSON: {exc}"})
        event_data.setdefault("created_at", _now_iso())
        event_data["id"] = f"evt-{len(events) + 1}"
        if settings.GOOGLE_CALENDAR_JSON and settings.GOOGLE_CALENDAR_ID:
            try:
                result = await _google_calendar_insert(event_data)
                event_data.update(result)
            except Exception as exc:
                event_data["delivered"] = False
                event_data["provider"] = "google"
                event_data["error"] = str(exc)
        else:
            event_data["delivered"] = False
            event_data["provider"] = "file-log"
        events.append(event_data)
        CALENDAR_PATH.write_text(json.dumps(events, indent=2), encoding="utf-8")
        return json.dumps({"created": event_data})

    return json.dumps({"error": "Unsupported action", "supported": ["list", "create"]})

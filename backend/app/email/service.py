import json
from pathlib import Path

import httpx

from app.core.config import settings
from app.email.templates import EmailContent

EMAIL_FALLBACK_LOG_PATH = Path("generated/email_log.jsonl")


def _from_header() -> str:
    return f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>"


async def send_transactional_email(to_email: str, content: EmailContent) -> None:
    if not settings.RESEND_API_KEY:
        _log_fallback(to_email=to_email, content=content, reason="missing_resend_api_key")
        return

    payload = {
        "from": _from_header(),
        "to": [to_email],
        "reply_to": settings.EMAIL_REPLY_TO,
        "subject": content.subject,
        "html": content.html,
        "text": content.text,
    }
    headers = {
        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post("https://api.resend.com/emails", json=payload, headers=headers)
        if response.status_code >= 400:
            _log_fallback(
                to_email=to_email,
                content=content,
                reason=f"resend_failed_{response.status_code}",
                provider_response=response.text,
            )


def _log_fallback(
    to_email: str,
    content: EmailContent,
    reason: str,
    provider_response: str | None = None,
) -> None:
    EMAIL_FALLBACK_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with EMAIL_FALLBACK_LOG_PATH.open("a", encoding="utf-8") as handle:
        handle.write(
            json.dumps(
                {
                    "to": to_email,
                    "subject": content.subject,
                    "reason": reason,
                    "provider_response": provider_response,
                    "text": content.text,
                }
            )
            + "\n"
        )

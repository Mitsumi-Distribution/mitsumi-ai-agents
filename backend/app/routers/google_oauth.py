"""Google OAuth2 — Calendar + Gmail integration.

Flow:
1. GET /api/auth/google/auth-url → generates consent URL with PKCE code_verifier stored in DB
2. User consents → Google redirects to /api/auth/google/callback?code=...&state=...
3. Backend retrieves code_verifier from DB, exchanges code for tokens
4. Tokens stored in MongoDB `google_tokens`
5. Agent tools use stored tokens with auto-refresh
"""

from __future__ import annotations

import json
import secrets
import hashlib
import base64
from datetime import datetime, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse

from app.core.auth import get_current_user_full
from app.core.config import settings
from app.core.mongo import mongo_db

router = APIRouter(prefix="/auth/google", tags=["google-oauth"])

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/userinfo.email",
]

TOKEN_COLLECTION = "google_tokens"
OAUTH_STATE_COLLECTION = "google_oauth_state"

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


def _get_redirect_uri() -> str:
    base_url = settings.APP_BASE_URL.rstrip("/")
    return f"{base_url}/api/auth/google/callback"


@router.get("/auth-url")
async def get_auth_url(request: Request, user=Depends(get_current_user_full)) -> dict:
    """Generate the Google OAuth consent URL with PKCE."""
    if not settings.GOOGLE_OAUTH_CLIENT_ID:
        raise HTTPException(400, "Google OAuth not configured")

    # Generate PKCE code_verifier and code_challenge
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode()).digest()
    ).rstrip(b"=").decode()

    state = secrets.token_urlsafe(32)

    # Store state + code_verifier + user email in DB
    await mongo_db[OAUTH_STATE_COLLECTION].insert_one({
        "state": state,
        "code_verifier": code_verifier,
        "user_email": user["email"],
        "created_at": datetime.now(timezone.utc),
    })

    params = {
        "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": _get_redirect_uri(),
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return {"url": auth_url, "state": state}


@router.get("/callback")
async def google_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    """Handle the OAuth callback from Google."""
    if error:
        return RedirectResponse(url=f"/settings?google_error={error}")
    if not code or not state:
        raise HTTPException(400, "Missing code or state")

    # Retrieve stored state + code_verifier
    state_doc = await mongo_db[OAUTH_STATE_COLLECTION].find_one_and_delete({"state": state})
    if not state_doc:
        return RedirectResponse(url="/settings?google_error=Invalid+or+expired+state")

    code_verifier = state_doc["code_verifier"]
    user_email = state_doc["user_email"]

    # Exchange authorization code for tokens
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data={
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
            "code": code,
            "code_verifier": code_verifier,
            "grant_type": "authorization_code",
            "redirect_uri": _get_redirect_uri(),
        })

    if resp.status_code != 200:
        error_data = resp.json()
        err_msg = error_data.get("error_description", error_data.get("error", "Token exchange failed"))
        return RedirectResponse(url=f"/settings?google_error={err_msg[:100]}")

    tokens = resp.json()
    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    expires_in = tokens.get("expires_in", 3600)

    # Get Google user info
    google_email = user_email
    try:
        async with httpx.AsyncClient() as client:
            user_resp = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if user_resp.status_code == 200:
                google_email = user_resp.json().get("email", user_email)
    except Exception:
        pass

    # Store tokens
    await mongo_db[TOKEN_COLLECTION].update_one(
        {"user_email": user_email},
        {"$set": {
            "user_email": user_email,
            "google_email": google_email,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_uri": GOOGLE_TOKEN_URL,
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
            "scopes": SCOPES,
            "expires_in": expires_in,
            "connected_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )

    return RedirectResponse(url="/settings?google_connected=true")


@router.get("/status")
async def google_status(user=Depends(get_current_user_full)) -> dict:
    """Check if user has connected their Google account."""
    token_doc = await mongo_db[TOKEN_COLLECTION].find_one(
        {"user_email": user["email"]},
        {"_id": 0, "access_token": 0, "refresh_token": 0, "client_secret": 0}
    )
    if not token_doc:
        return {"connected": False}
    return {
        "connected": True,
        "google_email": token_doc.get("google_email"),
        "scopes": token_doc.get("scopes", []),
        "connected_at": token_doc.get("connected_at"),
    }


@router.post("/disconnect")
async def google_disconnect(user=Depends(get_current_user_full)) -> dict:
    """Disconnect Google account."""
    await mongo_db[TOKEN_COLLECTION].delete_one({"user_email": user["email"]})
    return {"ok": True}


# ── Helper: get valid credentials for a user ──

async def get_user_credentials(user_email: str):
    """Load and auto-refresh Google credentials for a user."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request as GoogleRequest

    token_doc = await mongo_db[TOKEN_COLLECTION].find_one({"user_email": user_email})
    if not token_doc:
        return None

    creds = Credentials(
        token=token_doc["access_token"],
        refresh_token=token_doc.get("refresh_token"),
        token_uri=token_doc.get("token_uri", GOOGLE_TOKEN_URL),
        client_id=token_doc.get("client_id", settings.GOOGLE_OAUTH_CLIENT_ID),
        client_secret=token_doc.get("client_secret", settings.GOOGLE_OAUTH_CLIENT_SECRET),
        scopes=token_doc.get("scopes", SCOPES),
    )

    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(GoogleRequest())
            await mongo_db[TOKEN_COLLECTION].update_one(
                {"user_email": user_email},
                {"$set": {"access_token": creds.token}},
            )
        except Exception:
            return None

    return creds

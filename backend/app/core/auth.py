from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, WebSocket, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings

security = HTTPBearer(auto_error=False)


def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    expires_delta = timedelta(minutes=expires_minutes or settings.JWT_EXPIRE_MINUTES)
    now = datetime.now(timezone.utc)
    expire_at = now + expires_delta
    payload = {"sub": subject, "iat": now, "exp": expire_at, "type": "access"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


def _subject_from_credentials(credentials: HTTPAuthorizationCredentials | None) -> str:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    payload = decode_token(credentials.credentials)
    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return subject


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict[str, Any]:
    subject = _subject_from_credentials(credentials)
    return {"id": subject, "email": subject}


async def get_current_user_full(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict[str, Any]:
    # Lazy import to avoid circular dependency with `mongo`.
    from app.core.mongo import mongo_db

    subject = _subject_from_credentials(credentials)
    user = await mongo_db["users"].find_one({"email": subject})
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return {
        "id": subject,
        "email": subject,
        "name": user.get("name") or subject.split("@", 1)[0],
        "roles": user.get("roles") or [],
        "modules": user.get("modules") or [],
        "is_super_admin": bool(user.get("is_super_admin")),
        "region": user.get("region"),
        "country": user.get("country"),
        "status": user.get("status") or "active",
    }


async def get_ws_user(websocket: WebSocket) -> dict[str, Any]:
    token = websocket.query_params.get("token")
    if not token:
        auth_header = websocket.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing websocket token")
    payload = decode_token(token)
    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return {"id": subject, "email": subject}

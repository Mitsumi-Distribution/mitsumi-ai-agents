from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import create_access_token, get_current_user, get_current_user_full
from app.core.audit import record as audit_record
from app.core.mongo import mongo_db
from app.core.otp import deliver_otp_email
from app.email import password_reset_success_template, send_transactional_email
from app.core.security import (
    future_minutes,
    generate_otp_code,
    generate_reset_token,
    hash_password,
    hash_secret_value,
    is_allowed_email_domain,
    normalize_email,
    utc_now,
    verify_password,
)
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginOtpRequest(BaseModel):
    email: str
    password: str


class VerifyOtpRequest(BaseModel):
    email: str
    otp: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    reset_token: str
    new_password: str


@router.post("/login/request-otp")
async def request_login_otp(payload: LoginOtpRequest) -> dict:
    email = normalize_email(payload.email)
    if not is_allowed_email_domain(email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email domain not allowed")

    user = await mongo_db["users"].find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    otp_code = generate_otp_code()
    otp_doc = {
        "email": email,
        "purpose": "login",
        "otp_hash": hash_secret_value(otp_code),
        "created_at": utc_now(),
        "expires_at": future_minutes(settings.OTP_EXPIRE_MINUTES),
        "used": False,
        "attempts": 0,
        "max_attempts": settings.OTP_MAX_ATTEMPTS,
    }
    await mongo_db["auth_otps"].insert_one(otp_doc)
    await deliver_otp_email(email=email, purpose="login", otp_code=otp_code)
    return {"message": "OTP sent to email", "otp_expires_minutes": settings.OTP_EXPIRE_MINUTES}


@router.post("/login/verify-otp")
async def verify_login_otp(payload: VerifyOtpRequest) -> dict:
    email = normalize_email(payload.email)
    otp_doc = await mongo_db["auth_otps"].find_one(
        {"email": email, "purpose": "login", "used": False},
        sort=[("created_at", -1)],
    )
    if not otp_doc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active OTP challenge")

    if otp_doc.get("expires_at") <= utc_now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP expired")

    if otp_doc.get("attempts", 0) >= otp_doc.get("max_attempts", settings.OTP_MAX_ATTEMPTS):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="OTP attempts exceeded")

    if otp_doc.get("otp_hash") != hash_secret_value(payload.otp):
        await mongo_db["auth_otps"].update_one({"_id": otp_doc["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OTP")

    await mongo_db["auth_otps"].update_one({"_id": otp_doc["_id"]}, {"$set": {"used": True}})
    token = create_access_token(subject=email)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/password/request-reset-otp")
async def request_reset_otp(payload: ForgotPasswordRequest) -> dict:
    email = normalize_email(payload.email)
    if not is_allowed_email_domain(email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email domain not allowed")

    user = await mongo_db["users"].find_one({"email": email})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    otp_code = generate_otp_code()
    otp_doc = {
        "email": email,
        "purpose": "reset",
        "otp_hash": hash_secret_value(otp_code),
        "created_at": utc_now(),
        "expires_at": future_minutes(settings.OTP_EXPIRE_MINUTES),
        "used": False,
        "attempts": 0,
        "max_attempts": settings.OTP_MAX_ATTEMPTS,
    }
    await mongo_db["auth_otps"].insert_one(otp_doc)
    await deliver_otp_email(email=email, purpose="reset", otp_code=otp_code)
    return {"message": "Reset OTP sent to email", "otp_expires_minutes": settings.OTP_EXPIRE_MINUTES}


@router.post("/password/verify-reset-otp")
async def verify_reset_otp(payload: VerifyOtpRequest) -> dict:
    email = normalize_email(payload.email)
    otp_doc = await mongo_db["auth_otps"].find_one(
        {"email": email, "purpose": "reset", "used": False},
        sort=[("created_at", -1)],
    )
    if not otp_doc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active reset OTP challenge")
    if otp_doc.get("expires_at") <= utc_now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP expired")
    if otp_doc.get("attempts", 0) >= otp_doc.get("max_attempts", settings.OTP_MAX_ATTEMPTS):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="OTP attempts exceeded")
    if otp_doc.get("otp_hash") != hash_secret_value(payload.otp):
        await mongo_db["auth_otps"].update_one({"_id": otp_doc["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OTP")

    await mongo_db["auth_otps"].update_one({"_id": otp_doc["_id"]}, {"$set": {"used": True}})
    raw_reset_token = generate_reset_token()
    await mongo_db["reset_tokens"].insert_one(
        {
            "email": email,
            "token_hash": hash_secret_value(raw_reset_token),
            "created_at": utc_now(),
            "expires_at": future_minutes(settings.RESET_TOKEN_EXPIRE_MINUTES),
            "used": False,
        }
    )
    return {"reset_token": raw_reset_token, "reset_token_expires_minutes": settings.RESET_TOKEN_EXPIRE_MINUTES}


@router.post("/password/reset")
async def reset_password(payload: ResetPasswordRequest) -> dict:
    email = normalize_email(payload.email)
    token_doc = await mongo_db["reset_tokens"].find_one(
        {"email": email, "used": False},
        sort=[("created_at", -1)],
    )
    if not token_doc or token_doc.get("expires_at") <= utc_now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    if token_doc.get("token_hash") != hash_secret_value(payload.reset_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid reset token")

    await mongo_db["users"].update_one({"email": email}, {"$set": {"password_hash": hash_password(payload.new_password)}})
    await mongo_db["reset_tokens"].update_one({"_id": token_doc["_id"]}, {"$set": {"used": True}})
    await send_transactional_email(to_email=email, content=password_reset_success_template(email=email))
    return {"message": "Password reset successful"}


@router.post("/refresh")
async def refresh_token(user=Depends(get_current_user)) -> dict:
    token = create_access_token(subject=user["id"])
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login/direct")
async def login_direct(payload: LoginOtpRequest) -> dict:
    """Dev-only password-based login that bypasses OTP.

    Gated behind ``DEV_AUTH_BYPASS_OTP`` to keep the regular OTP flow for prod.
    Returns the same shape as ``/login/verify-otp``.
    """
    if not settings.DEV_AUTH_BYPASS_OTP:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Direct login disabled")

    email = normalize_email(payload.email)
    if not is_allowed_email_domain(email):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email domain not allowed")

    user = await mongo_db["users"].find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(subject=email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "email": email,
            "name": user.get("name") or email.split("@", 1)[0],
            "roles": user.get("roles") or [],
            "modules": user.get("modules") or [],
            "is_super_admin": bool(user.get("is_super_admin")),
            "region": user.get("region"),
            "country": user.get("country"),
            "status": user.get("status") or "active",
            "server_flags": {
                "llm_ready": settings.llm_ready,
                "resend_ready": bool(getattr(settings, "RESEND_API_KEY", "")),
                "tavily_ready": bool(getattr(settings, "TAVILY_API_KEY", "")),
                "google_ready": bool(getattr(settings, "GOOGLE_API_KEY", "")),
            },
        },
    }


class SetPasswordRequest(BaseModel):
    email: str
    token: str
    new_password: str


@router.post("/invite/set-password")
async def set_invite_password(payload: SetPasswordRequest) -> dict:
    """Accept a fresh password for an invited user using the invite token."""
    email = normalize_email(payload.email)
    user = await mongo_db["users"].find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    expected = user.get("invite_token")
    if not expected or expected != payload.token:
        raise HTTPException(status_code=401, detail="Invalid invite token")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    await mongo_db["users"].update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password_hash": hash_password(payload.new_password), "status": "active"},
            "$unset": {"invite_token": "", "invite_expires_at": ""},
        },
    )
    await audit_record("user.password_set", actor=email, target=email)
    token = create_access_token(subject=email)
    return {"access_token": token, "token_type": "bearer", "email": email}


@router.get("/me")
async def get_me(user=Depends(get_current_user_full)) -> dict:
    from app.core.config import settings as _settings
    return {
        **user,
        "server_flags": {
            "llm_ready": _settings.llm_ready,
            "resend_ready": bool(getattr(_settings, "RESEND_API_KEY", "")),
            "tavily_ready": bool(getattr(_settings, "TAVILY_API_KEY", "")),
            "google_ready": bool(getattr(_settings, "GOOGLE_API_KEY", "")),
        },
    }

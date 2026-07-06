"""Settings & user management.

Endpoints:
    GET  /api/settings/regions      -> region + country list
    GET  /api/settings/roles        -> role + permission matrix
    GET  /api/users                 -> list users (admin only)
    POST /api/users/invite          -> create+invite a user
    PATCH /api/users/{user_id}      -> update role / region / country
    DELETE /api/users/{user_id}     -> remove user
    GET  /api/users/me/preferences  -> get my preferences
    PATCH /api/users/me/preferences -> update my preferences
"""

from __future__ import annotations

import asyncio
import secrets
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field

from app.core.auth import get_current_user_full
from app.core.audit import record as audit_record
from app.core.config import settings
from app.core.country_catalog import COUNTRY_CATALOG
from app.core.mongo import ALL_MODULES, mongo_db, user_has_module
from app.core import regions_db
from app.core.scope import (
    ADMIN_ROLES,
    ALL_COUNTRIES,
    ALL_REGIONS,
    COUNTRY_TO_REGION,
    REGIONS,
    ROLES,
    ROLE_KEYS,
    can_invite,
    highest_role,
    region_for_country,
)
from app.core.security import hash_password, normalize_email

router = APIRouter(tags=["settings-users"])


# ---------- helpers --------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize_user(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "email": doc.get("email"),
        "name": doc.get("name"),
        "roles": doc.get("roles") or [],
        "region": doc.get("region"),
        "country": doc.get("country"),
        "modules": doc.get("modules") or [],
        "is_super_admin": bool(doc.get("is_super_admin")),
        "status": doc.get("status") or "active",
        "created_at": (doc.get("created_at") or _now()).isoformat() if isinstance(doc.get("created_at"), datetime) else doc.get("created_at"),
    }


async def _require_admin(user: dict) -> None:
    if user.get("is_super_admin"):
        return
    if any(r in ADMIN_ROLES for r in (user.get("roles") or [])):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")


async def _send_invite_email(email: str, token: str, invitee_name: str | None) -> dict:
    """Send an invite email via Resend, falling back to stdout log if no key."""
    invite_url = f"{settings.APP_BASE_URL.rstrip('/')}/set-password?token={token}&email={email}"
    subject = "You have been invited to Mitsumi AI"
    html = f"""
    <table style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <tr><td style="padding:24px 16px">
        <h2 style="margin:0 0 8px 0;color:#0f172a">Welcome to Mitsumi AI</h2>
        <p style="color:#334155;font-size:14px">Hi {invitee_name or email},</p>
        <p style="color:#334155;font-size:14px">You have been invited to join the Mitsumi Distribution AI platform. Click the button below to set a password and sign in.</p>
        <p style="margin:20px 0">
          <a href="{invite_url}" style="background:#4F46E5;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600">Set your password</a>
        </p>
        <p style="color:#64748b;font-size:12px">If the button doesn't work, paste this URL: {invite_url}</p>
      </td></tr>
    </table>
    """
    text = f"Welcome to Mitsumi AI. Set your password: {invite_url}"

    if not settings.RESEND_API_KEY:
        return {"delivered": False, "reason": "missing_resend_api_key", "invite_url": invite_url}

    try:
        import resend  # type: ignore
        resend.api_key = settings.RESEND_API_KEY
        params = {
            "from": f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>",
            "to": [email],
            "subject": subject,
            "html": html,
            "text": text,
        }
        result = await asyncio.to_thread(resend.Emails.send, params)
        return {"delivered": True, "email_id": (result or {}).get("id"), "invite_url": invite_url}
    except Exception as exc:
        return {"delivered": False, "reason": str(exc), "invite_url": invite_url}


# ---------- settings -------------------------------------------------------


@router.get("/settings/regions")
async def list_regions(user=Depends(get_current_user_full)) -> dict:
    regions = await regions_db.list_regions()
    return {"regions": regions}


@router.get("/settings/country-catalog")
async def list_country_catalog(user=Depends(get_current_user_full)) -> dict:
    """Full ISO country list for the region editor."""
    return {"countries": COUNTRY_CATALOG}


class RegionCreate(BaseModel):
    key: str
    label: str | None = None
    countries: list[dict] | None = None


class RegionUpdate(BaseModel):
    label: str | None = None
    countries: list[dict] | None = None


class CountryPayload(BaseModel):
    code: str
    name: str


@router.post("/settings/regions")
async def create_region(payload: RegionCreate, user=Depends(get_current_user_full)) -> dict:
    await _require_admin(user)
    try:
        region = await regions_db.create_region(
            key=payload.key, label=payload.label or payload.key.title(), countries=payload.countries or []
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    await audit_record("region.create", actor=user, target=region["key"], metadata={"label": region["label"]})
    return region


@router.patch("/settings/regions/{key}")
async def patch_region(key: str, payload: RegionUpdate, user=Depends(get_current_user_full)) -> dict:
    await _require_admin(user)
    region = await regions_db.update_region(key, label=payload.label, countries=payload.countries)
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    await audit_record("region.update", actor=user, target=key, metadata=payload.dict(exclude_none=True))
    return region


@router.delete("/settings/regions/{key}")
async def remove_region(
    key: str,
    cascade: bool = False,
    user=Depends(get_current_user_full),
) -> dict:
    await _require_admin(user)
    # Precheck: count users assigned to this region so the admin sees the blast
    # radius before deciding to cascade.
    user_count = await mongo_db["users"].count_documents({"region": key})
    if user_count > 0 and not cascade:
        raise HTTPException(
            status_code=409,
            detail=(
                f"{user_count} user(s) are assigned to this region. "
                "Retry with ?cascade=true to null their region and delete scoped data."
            ),
        )
    outcome = await regions_db.delete_region(key, cascade=cascade)
    if not outcome["deleted"]:
        raise HTTPException(status_code=404, detail="Region not found")
    await audit_record(
        "region.delete",
        actor=user,
        target=key,
        metadata={
            "cascade": cascade,
            "affected": outcome["affected"],
            "users_nulled": outcome["users_nulled"],
        },
    )
    return {
        "ok": True,
        "cascade": cascade,
        "affected": outcome["affected"],
        "users_nulled": outcome["users_nulled"],
    }


@router.post("/settings/regions/{key}/countries")
async def add_country(key: str, payload: CountryPayload, user=Depends(get_current_user_full)) -> dict:
    await _require_admin(user)
    try:
        region = await regions_db.add_country(key, code=payload.code, name=payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    await audit_record(
        "region.country.add", actor=user, target=key, metadata={"code": payload.code, "name": payload.name}
    )
    return region


@router.delete("/settings/regions/{key}/countries/{code}")
async def delete_country(key: str, code: str, user=Depends(get_current_user_full)) -> dict:
    await _require_admin(user)
    try:
        region = await regions_db.remove_country(key, code=code)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not region:
        raise HTTPException(status_code=404, detail="Region not found")
    await audit_record("region.country.remove", actor=user, target=key, metadata={"code": code})
    return region


@router.get("/settings/roles")
async def list_roles(user=Depends(get_current_user_full)) -> dict:
    return {"roles": ROLES}


# ---------- users ----------------------------------------------------------


class InviteRequest(BaseModel):
    email: EmailStr
    name: str | None = None
    role: str = Field(default="member")
    region: str | None = None
    country: str | None = None
    modules: list[str] | None = None


class UpdateUserRequest(BaseModel):
    name: str | None = None
    role: str | None = None
    region: str | None = None
    country: str | None = None
    modules: list[str] | None = None
    status: str | None = None


@router.get("/users")
async def list_users(
    q: str | None = Query(default=None),
    role: str | None = Query(default=None),
    region: str | None = Query(default=None),
    country: str | None = Query(default=None),
    user=Depends(get_current_user_full),
) -> list[dict]:
    await _require_admin(user)
    filt: dict[str, Any] = {}
    if q:
        filt["$or"] = [
            {"email": {"$regex": q, "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}},
        ]
    if role:
        filt["roles"] = role
    if region:
        filt["region"] = region.lower()
    if country:
        filt["country"] = country.upper()

    # Non super admins: restrict listing to their own scope.
    if not user.get("is_super_admin"):
        user_region = user.get("region")
        user_country = user.get("country")
        if "country_admin" in (user.get("roles") or []):
            filt["country"] = user_country
        elif user_region:
            filt["region"] = user_region

    cursor = mongo_db["users"].find(filt).sort("created_at", -1).limit(100)
    return [_serialize_user(u) async for u in cursor]


@router.get("/users/mention-search")
async def mention_search(
    q: str | None = Query(default=None, max_length=64),
    user=Depends(get_current_user_full),
) -> list[dict]:
    """Lightweight, member-accessible directory lookup for @mention autocomplete.

    Returns only `{email, name}` (no roles / region / phone) scoped to the same
    region as the caller so members don't leak cross-region teammate info.
    Caller themselves is filtered out. Max 8 results.
    """
    filt: dict[str, Any] = {"status": {"$ne": "deactivated"}}
    # Exclude self.
    if user.get("email"):
        filt["email"] = {"$ne": user["email"]}
    if q:
        needle = q.strip().lstrip("@")
        if needle:
            filt["$or"] = [
                {"email": {"$regex": needle, "$options": "i"}},
                {"name": {"$regex": needle, "$options": "i"}},
            ]
    # Region scope: super admin sees everyone, members see their own region.
    if not user.get("is_super_admin"):
        user_region = user.get("region")
        if user_region:
            filt["region"] = user_region
    cursor = (
        mongo_db["users"]
        .find(filt, {"_id": 0, "email": 1, "name": 1, "region": 1, "country": 1})
        .sort("name", 1)
        .limit(8)
    )
    return [u async for u in cursor]


@router.post("/users/invite")
async def invite_user(payload: InviteRequest, user=Depends(get_current_user_full)) -> dict:
    await _require_admin(user)
    if payload.role not in ROLE_KEYS:
        raise HTTPException(status_code=400, detail=f"Unknown role: {payload.role}")
    if not (user.get("is_super_admin") or can_invite(user.get("roles"), payload.role)):
        raise HTTPException(status_code=403, detail="You cannot invite that role")

    # Normalize region/country
    region = (payload.region or "").lower() or None
    country = (payload.country or "").upper() or None
    if country and country not in ALL_COUNTRIES:
        raise HTTPException(status_code=400, detail="Unknown country")
    if region and region not in ALL_REGIONS:
        raise HTTPException(status_code=400, detail="Unknown region")
    if country and not region:
        region = region_for_country(country)

    # Non-super admins can only invite within their own scope.
    if not user.get("is_super_admin"):
        if user.get("region") and region != user.get("region"):
            raise HTTPException(status_code=403, detail="Out-of-scope region")
        if "country_admin" in (user.get("roles") or []) and country != user.get("country"):
            raise HTTPException(status_code=403, detail="Out-of-scope country")

    email = normalize_email(payload.email)
    existing = await mongo_db["users"].find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="User already exists")

    # Default module access by role
    modules = payload.modules or [
        "dashboard", "tasks", "tool_results",
        "agent:sales", "agent:marketing", "agent:finance", "agent:ops",
        "department:sales", "department:marketing", "department:finance", "department:ops",
    ]
    if payload.role in {"super_admin"}:
        modules = ALL_MODULES

    temp_password = secrets.token_urlsafe(10)
    invite_token = secrets.token_urlsafe(24)

    doc = {
        "email": email,
        "name": payload.name or email.split("@", 1)[0],
        "roles": [payload.role],
        "region": region,
        "country": country,
        "modules": modules,
        "is_super_admin": payload.role == "super_admin",
        "password_hash": hash_password(temp_password),
        "invite_token": invite_token,
        "invite_expires_at": _now().replace(microsecond=0),
        "status": "invited",
        "created_at": _now(),
        "invited_by": user.get("email"),
    }
    result = await mongo_db["users"].insert_one(doc)
    doc["_id"] = result.inserted_id

    email_result = await _send_invite_email(email, invite_token, doc["name"])

    from app.core.notifications import notify as _notify
    await _notify(
        recipient_email=email,
        kind="user",
        title="Welcome to Mitsumi AI",
        body=f"{user.get('name') or user.get('email')} invited you as {payload.role.replace('_',' ')}.",
        link="/",
        metadata={"role": payload.role, "invited_by": user.get("email")},
    )

    await audit_record(
        "user.invite",
        actor=user,
        target=email,
        metadata={
            "role": payload.role,
            "region": region,
            "country": country,
            "delivered": bool(email_result.get("delivered")),
        },
    )

    return {
        "user": _serialize_user(doc),
        "email": email_result,
        "temp_password": temp_password if not email_result.get("delivered") else None,
    }


@router.patch("/users/{user_id}")
async def update_user(user_id: str, payload: UpdateUserRequest, user=Depends(get_current_user_full)) -> dict:
    await _require_admin(user)
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user id")

    target = await mongo_db["users"].find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    update: dict[str, Any] = {}
    if payload.name is not None:
        update["name"] = payload.name
    if payload.role is not None:
        if payload.role not in ROLE_KEYS:
            raise HTTPException(status_code=400, detail="Unknown role")
        update["roles"] = [payload.role]
        update["is_super_admin"] = payload.role == "super_admin"
    if payload.region is not None:
        update["region"] = payload.region.lower() or None
    if payload.country is not None:
        update["country"] = (payload.country.upper() or None) if payload.country else None
        if update["country"] and not update.get("region"):
            update["region"] = region_for_country(update["country"])
    if payload.modules is not None:
        update["modules"] = payload.modules
    if payload.status is not None:
        update["status"] = payload.status

    if not update:
        return _serialize_user(target)

    await mongo_db["users"].update_one({"_id": target["_id"]}, {"$set": update})
    updated = await mongo_db["users"].find_one({"_id": target["_id"]})
    await audit_record("user.update", actor=user, target=target.get("email"), metadata={"changes": update})
    return _serialize_user(updated or {})


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, user=Depends(get_current_user_full)) -> dict:
    await _require_admin(user)
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user id")
    target = await mongo_db["users"].find_one({"_id": ObjectId(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("is_super_admin"):
        raise HTTPException(status_code=400, detail="Cannot delete a super admin")
    await mongo_db["users"].delete_one({"_id": target["_id"]})
    await audit_record("user.delete", actor=user, target=target.get("email"))
    return {"ok": True, "deleted": user_id}


# ---------- preferences ----------------------------------------------------


class PreferencesUpdate(BaseModel):
    theme: str | None = None
    timezone: str | None = None
    notifications: dict | None = None
    default_region: str | None = None
    default_country: str | None = None


@router.get("/users/me/preferences")
async def get_my_preferences(user=Depends(get_current_user_full)) -> dict:
    full = await mongo_db["users"].find_one({"email": user["email"]})
    prefs = (full or {}).get("preferences") or {}
    return {
        "theme": prefs.get("theme") or "system",
        "timezone": prefs.get("timezone") or "Africa/Nairobi",
        "notifications": prefs.get("notifications") or {"email": True, "in_app": True},
        "default_region": prefs.get("default_region") or full.get("region") if full else None,
        "default_country": prefs.get("default_country") or full.get("country") if full else None,
    }


@router.patch("/users/me/preferences")
async def update_my_preferences(payload: PreferencesUpdate, user=Depends(get_current_user_full)) -> dict:
    update = {f"preferences.{k}": v for k, v in payload.dict(exclude_none=True).items()}
    if not update:
        return await get_my_preferences(user)
    await mongo_db["users"].update_one({"email": user["email"]}, {"$set": update})
    await audit_record(
        "preferences.update",
        actor=user,
        target=user.get("email"),
        metadata=payload.dict(exclude_none=True),
    )
    return await get_my_preferences(user)



# ---------- Model configuration -----------------------------------------

class ModelAssignment(BaseModel):
    department: str
    model_key: str


@router.get("/settings/models")
async def get_models(user=Depends(get_current_user_full)) -> dict:
    """Return the model catalogue and per-department model assignments."""
    from app.core.model_config import get_all_department_models
    return await get_all_department_models()


@router.patch("/settings/models")
async def set_model(payload: ModelAssignment, user=Depends(get_current_user_full)) -> dict:
    """Assign a model to a department. Admin only."""
    from app.core.scope import ADMIN_ROLES
    if not (user.get("is_super_admin") or (set(user.get("roles") or []) & ADMIN_ROLES)):
        raise HTTPException(status_code=403, detail="Admins only")
    from app.core.model_config import set_department_model
    try:
        result = await set_department_model(payload.department, payload.model_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    await audit_record(
        "model.update",
        actor=user,
        target=payload.department,
        metadata={"model_key": payload.model_key},
    )
    return result



# ---------- Token usage tracking ----------------------------------------

@router.get("/settings/token-usage")
async def get_token_usage(days: int = 30, user=Depends(get_current_user_full)) -> dict:
    """Return aggregated token usage by department and model. Admin only."""
    from app.core.scope import ADMIN_ROLES
    if not (user.get("is_super_admin") or (set(user.get("roles") or []) & ADMIN_ROLES)):
        raise HTTPException(status_code=403, detail="Admins only")
    from app.core.token_tracking import get_usage_summary
    return await get_usage_summary(days=min(max(1, days), 365))


# ---------- Approvals Dashboard ----------------------------------------

@router.get("/settings/approvals")
async def list_approvals(
    status: str | None = None,
    category: str | None = None,
    user=Depends(get_current_user_full),
) -> list:
    """List approval requests. Admins see all, others see their own."""
    from app.core.scope import ADMIN_ROLES
    filt: dict = {}
    is_admin = user.get("is_super_admin") or (set(user.get("roles") or []) & ADMIN_ROLES)
    if not is_admin:
        filt["approver_email"] = user["email"]
    if status:
        filt["status"] = status
    if category:
        filt["category"] = category
    docs = await mongo_db["approvals"].find(filt).sort("created_at", -1).limit(100).to_list(length=100)
    for d in docs:
        d["id"] = str(d.pop("_id"))
        for k in ("created_at", "updated_at"):
            if hasattr(d.get(k), "isoformat"):
                d[k] = d[k].isoformat()
    return docs


class ApprovalUpdate(BaseModel):
    status: str  # approved / rejected
    note: str = ""


@router.patch("/settings/approvals/{approval_id}")
async def update_approval(approval_id: str, payload: ApprovalUpdate, user=Depends(get_current_user_full)) -> dict:
    """Approve or reject an approval request."""
    from bson import ObjectId
    from datetime import datetime, timezone
    if not ObjectId.is_valid(approval_id):
        raise HTTPException(400, "Invalid ID")
    result = await mongo_db["approvals"].find_one_and_update(
        {"_id": ObjectId(approval_id)},
        {"$set": {
            "status": payload.status,
            "reviewer_email": user["email"],
            "reviewer_note": payload.note,
            "updated_at": datetime.now(timezone.utc),
        }},
        return_document=True,
    )
    if not result:
        raise HTTPException(404, "Approval not found")
    result["id"] = str(result.pop("_id"))
    for k in ("created_at", "updated_at"):
        if hasattr(result.get(k), "isoformat"):
            result[k] = result[k].isoformat()
    return result



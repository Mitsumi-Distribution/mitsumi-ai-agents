import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from app.core.config import settings


def normalize_email(email: str) -> str:
    return email.strip().lower()


def is_allowed_email_domain(email: str) -> bool:
    normalized = normalize_email(email)
    return normalized.endswith(f"@{settings.AUTH_ALLOWED_DOMAIN}")


def hash_password(password: str, salt: str | None = None) -> str:
    secret_salt = salt or secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), secret_salt.encode("utf-8"), 150_000)
    return f"{secret_salt}${derived.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, expected_hash = password_hash.split("$", 1)
    except ValueError:
        return False
    candidate = hash_password(password, salt).split("$", 1)[1]
    return hmac.compare_digest(candidate, expected_hash)


def hash_secret_value(value: str) -> str:
    return hashlib.sha256(f"{settings.JWT_SECRET}:{value}".encode("utf-8")).hexdigest()


def generate_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def generate_reset_token() -> str:
    return secrets.token_urlsafe(32)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def future_minutes(minutes: int) -> datetime:
    return utc_now() + timedelta(minutes=minutes)

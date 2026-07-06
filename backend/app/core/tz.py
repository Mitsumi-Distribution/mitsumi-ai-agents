"""Centralized timezone helper — uses the configured region timezone.

All timestamps displayed to users (notifications, PDFs, emails, chat)
should use this timezone. Internal storage still uses UTC.
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.core.config import settings

_tz: ZoneInfo | None = None


def get_tz() -> ZoneInfo:
    global _tz
    if _tz is None:
        try:
            _tz = ZoneInfo(settings.GOOGLE_CALENDAR_TIMEZONE)
        except Exception:
            _tz = ZoneInfo("Africa/Nairobi")
    return _tz


def now_local() -> datetime:
    """Current time in the configured timezone."""
    return datetime.now(get_tz())


def format_datetime(dt: datetime | None = None, fmt: str = "%B %d, %Y at %I:%M %p %Z") -> str:
    """Format a datetime for display in the user's timezone."""
    if dt is None:
        dt = now_local()
    elif dt.tzinfo is None or dt.tzinfo == timezone.utc:
        dt = dt.replace(tzinfo=timezone.utc).astimezone(get_tz())
    return dt.strftime(fmt)


def format_short(dt: datetime | None = None) -> str:
    """Short format: 'Apr 23, 2026 3:45 PM EAT'"""
    return format_datetime(dt, "%b %d, %Y %I:%M %p %Z")


def format_time(dt: datetime | None = None) -> str:
    """Time only: '3:45 PM EAT'"""
    return format_datetime(dt, "%I:%M %p %Z")


def tz_name() -> str:
    """Return the timezone abbreviation (e.g., 'EAT')."""
    return now_local().strftime("%Z")

"""Redis-backed tool result cache.

Caches tool outputs for a configurable TTL so repeated identical queries
(same tool + same args) skip the MongoDB round-trip. Cache is best-effort;
failures degrade gracefully to direct execution.
"""

from __future__ import annotations

import hashlib
import json

from redis.asyncio import from_url
from redis.exceptions import RedisError

from app.core.config import settings

_redis = from_url(settings.REDIS_URL, decode_responses=True)

CACHE_TTL = 300  # 5 minutes default


def _cache_key(tool_name: str, args: dict) -> str:
    """Deterministic key from tool name + sorted args."""
    raw = json.dumps({"t": tool_name, "a": args}, sort_keys=True, default=str)
    h = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"toolcache:{tool_name}:{h}"


async def get_cached(tool_name: str, args: dict) -> str | None:
    """Return cached result or None."""
    try:
        return await _redis.get(_cache_key(tool_name, args))
    except (RedisError, OSError):
        return None


async def set_cached(tool_name: str, args: dict, result: str, ttl: int = CACHE_TTL) -> None:
    """Store a tool result in cache."""
    try:
        await _redis.set(_cache_key(tool_name, args), result, ex=ttl)
    except (RedisError, OSError):
        pass

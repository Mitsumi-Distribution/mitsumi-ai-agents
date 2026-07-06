"""Tiny Redis pub/sub bridge for cross-process events.

The arq worker process publishes events to a single channel; the FastAPI
process subscribes on startup and forwards them to the owning user's
WebSockets via the in-process ws_manager.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import redis.asyncio as redis_asyncio

from app.core.config import settings
from app.core.ws import ws_manager

log = logging.getLogger("events")

CHANNEL = "mitsumi.events"


async def publish(user_id: str, payload: dict[str, Any]) -> None:
    """Fire-and-forget publish from anywhere (same or different process)."""
    try:
        client = redis_asyncio.from_url(settings.REDIS_URL)
        try:
            await client.publish(CHANNEL, json.dumps({"user": user_id, "payload": payload}, default=str))
        finally:
            try:
                await client.aclose()
            except Exception:
                pass
    except Exception as exc:  # pragma: no cover
        log.warning("events.publish failed: %s", exc)


async def subscriber_loop() -> None:
    """Long-running coroutine — started by FastAPI, forwards events to WS."""
    while True:
        client: redis_asyncio.Redis | None = None
        pubsub = None
        try:
            client = redis_asyncio.from_url(settings.REDIS_URL)
            pubsub = client.pubsub()
            await pubsub.subscribe(CHANNEL)
            log.info("events subscriber connected to %s", CHANNEL)
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message is None:
                    continue
                try:
                    raw = message.get("data")
                    if isinstance(raw, bytes):
                        raw = raw.decode("utf-8")
                    data = json.loads(raw)
                    await ws_manager.broadcast_to_user(data["user"], data["payload"])
                except Exception as exc:  # pragma: no cover
                    log.warning("events dispatch failed: %s", exc)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            log.warning("events subscriber error, reconnecting in 2s: %s", exc)
            await asyncio.sleep(2)
        finally:
            if pubsub is not None:
                try:
                    await pubsub.unsubscribe(CHANNEL)
                except Exception:
                    pass
                try:
                    await pubsub.aclose()
                except Exception:
                    pass
            if client is not None:
                try:
                    await client.aclose()
                except Exception:
                    pass

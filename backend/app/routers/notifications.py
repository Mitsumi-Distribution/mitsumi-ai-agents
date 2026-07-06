"""Notifications REST endpoints + WebSocket push."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect

from app.core.auth import get_current_user_full, get_ws_user
from app.core import notifications as notif
from app.core.ws import ws_manager

log = logging.getLogger("notifications-router")

router = APIRouter(prefix="/notifications", tags=["notifications"])
ws_router = APIRouter(tags=["notifications-ws"])


@router.get("")
async def list_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = False,
    kind: str | None = None,
    user=Depends(get_current_user_full),
) -> dict:
    return await notif.list_for_user(
        user["email"], skip=skip, limit=limit, unread_only=unread_only, kind=kind
    )


@router.get("/unread-count")
async def get_unread_count(user=Depends(get_current_user_full)) -> dict:
    return {"unread": await notif.unread_count(user["email"])}


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str, user=Depends(get_current_user_full)
) -> dict:
    if not await notif.mark_read(user["email"], notification_id):
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(user=Depends(get_current_user_full)) -> dict:
    count = await notif.mark_all_read(user["email"])
    return {"ok": True, "updated": count}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str, user=Depends(get_current_user_full)
) -> dict:
    if not await notif.delete(user["email"], notification_id):
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@ws_router.websocket("/ws/notifications")
async def notifications_ws(websocket: WebSocket) -> None:
    """Live push channel for in-app notifications.

    Uses the same `events.publish → subscriber_loop → ws_manager` pub/sub
    pipeline as the agent-task updates. Each connected client receives only
    events addressed to their email (the channel key).
    """
    try:
        user = await get_ws_user(websocket)
    except HTTPException:
        try:
            await websocket.close(code=1008)
        except Exception:
            pass
        return
    key = (user.get("email") or user.get("id") or "").lower()
    if not key:
        try:
            await websocket.close(code=1008)
        except Exception:
            pass
        return
    await ws_manager.connect(key, websocket)
    try:
        # Push an initial unread count so the badge hydrates instantly.
        try:
            unread = await notif.unread_count(key)
            await websocket.send_json({"type": "hello", "unread": unread})
        except Exception as exc:  # pragma: no cover
            log.debug("notifications hello failed: %s", exc)
        while True:
            # We don't expect any client → server messages, but `receive_text`
            # keeps the connection alive and raises on disconnect.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # pragma: no cover
        log.debug("notifications ws closed: %s", exc)
    finally:
        ws_manager.disconnect(key, websocket)

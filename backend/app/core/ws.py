from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[user_id].add(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        self._connections[user_id].discard(websocket)
        if not self._connections[user_id]:
            self._connections.pop(user_id, None)

    async def broadcast_to_user(self, user_id: str, payload: dict) -> None:
        sockets = self._connections.get(user_id, set())
        for socket in tuple(sockets):
            try:
                await socket.send_json(payload)
            except Exception:
                pass

    async def send_to_user(self, user_id: str, payload: dict) -> None:
        """Alias for broadcast_to_user — best-effort send to all user connections."""
        await self.broadcast_to_user(user_id, payload)


ws_manager = ConnectionManager()

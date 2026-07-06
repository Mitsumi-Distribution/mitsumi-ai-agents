from app.routers.agents import router as agent_router
from app.routers.agents import ws_router
from app.routers.notifications import ws_router as notifications_ws_router
from app.routers.agent_tasks import router as agent_tasks_router
from app.routers.audit import router as audit_router
from app.routers.auth import router as auth_router
from app.routers.chats import router as chats_router
from app.routers.departments import router as departments_router
from app.routers.health import router as health_router
from app.routers.notifications import router as notifications_router
from app.routers.settings import router as settings_router
from app.routers.tasks import router as tasks_router
from app.routers.tools import router as tools_router
from app.routers.google_oauth import router as google_router

__all__ = [
    "agent_router",
    "agent_tasks_router",
    "audit_router",
    "auth_router",
    "chats_router",
    "departments_router",
    "google_router",
    "health_router",
    "notifications_router",
    "settings_router",
    "tasks_router",
    "tools_router",
    "ws_router",
    "notifications_ws_router",
]

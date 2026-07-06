from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.core.audit import ensure_indexes as ensure_audit_indexes
from app.core.config import settings
from app.core.events import subscriber_loop
from app.core.jobs import ensure_indexes as ensure_agent_task_indexes
from app.core.mongo import seed_mongo
from app.core.notifications import ensure_indexes as ensure_notification_indexes
from app.core.regions_db import seed_and_refresh as seed_regions
from app.core.token_tracking import ensure_indexes as ensure_token_indexes
from app.core.documents import ensure_indexes as ensure_doc_indexes
from app.core.notes import ensure_indexes as ensure_notes_indexes
from app.routers import (
    agent_router,
    agent_tasks_router,
    audit_router,
    auth_router,
    chats_router,
    departments_router,
    google_router,
    health_router,
    notifications_router,
    settings_router,
    tasks_router,
    tools_router,
    ws_router,
    notifications_ws_router,
)

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

app = FastAPI(title=settings.APP_NAME)
app.state.limiter = limiter

async def rate_limit_handler(request, exc):
    return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})


app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(agent_router, prefix=settings.API_PREFIX)
app.include_router(agent_tasks_router, prefix=settings.API_PREFIX)
app.include_router(audit_router, prefix=settings.API_PREFIX)
app.include_router(chats_router, prefix=settings.API_PREFIX)
app.include_router(departments_router, prefix=settings.API_PREFIX)
app.include_router(google_router, prefix=settings.API_PREFIX)
app.include_router(health_router, prefix=settings.API_PREFIX)
app.include_router(notifications_router, prefix=settings.API_PREFIX)
app.include_router(settings_router, prefix=settings.API_PREFIX)
app.include_router(tasks_router, prefix=settings.API_PREFIX)
app.include_router(tools_router, prefix=settings.API_PREFIX)
app.include_router(ws_router, prefix=settings.API_PREFIX)
app.include_router(notifications_ws_router, prefix=settings.API_PREFIX)

# Serve generated files (PDFs, Excel) at /api/static/
import os as _os
_gen_dir = _os.path.join(_os.path.dirname(_os.path.dirname(__file__)), "generated")
_os.makedirs(_gen_dir, exist_ok=True)
app.mount("/api/static", StaticFiles(directory=_gen_dir), name="generated-files")


@app.on_event("startup")
async def startup_event() -> None:
    import asyncio as _asyncio
    await seed_mongo()
    await seed_regions()
    await ensure_audit_indexes()
    await ensure_agent_task_indexes()
    await ensure_notification_indexes()
    await ensure_token_indexes()
    await ensure_doc_indexes()
    await ensure_notes_indexes()
    # Background Redis→WebSocket forwarder for cross-process task events.
    _asyncio.create_task(subscriber_loop())
    # Start embedded arq worker — runs in-process, always alive
    _asyncio.create_task(_start_embedded_worker())


async def _start_embedded_worker() -> None:
    """Run arq worker polling loop inside the FastAPI process."""
    import asyncio
    import logging
    log = logging.getLogger("embedded_worker")

    await asyncio.sleep(3)  # Let FastAPI finish startup

    while True:
        try:
            from arq.worker import Worker
            from app.core.jobs import redis_settings as _rs, run_task
            from app.core import handlers  # noqa: F401

            worker = Worker(
                functions=[run_task],
                redis_settings=_rs(),
                max_jobs=5,
                job_timeout=900,
                keep_result_forever=False,
                handle_signals=False,  # Don't interfere with FastAPI signals
            )
            log.info("Embedded arq worker started")
            # main() is the core polling loop
            await worker.main()
        except asyncio.CancelledError:
            log.info("Worker cancelled")
            break
        except Exception as exc:
            log.error(f"Worker error: {exc}")
            await asyncio.sleep(5)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}

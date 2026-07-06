"""Supervisor entry point.

The Emergent platform runs `uvicorn server:app` from /app/backend.
This module simply re-exports the real FastAPI application defined in
`app.main` so we don't have to touch the upstream module layout.
"""

from app.main import app

__all__ = ["app"]

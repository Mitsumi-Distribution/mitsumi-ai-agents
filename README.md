# Mitsumi AI Agent Platform

Monorepo for a provider-agnostic AI agent platform:
- Frontend: React + Vite + TypeScript
- Backend: FastAPI + LangChain/LangGraph
- Data: Postgres + pgvector, Redis, MongoDB

## Quick Start

1. Copy env file:

```bash
cp .env.example .env
```

2. Start services:

```bash
docker compose up --build
```

3. Open:
- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs

## Seeded Demo User

- Email: `demo@mitsumidistribution.com`
- Password: `demo123`

## Core Endpoints

- `POST /api/auth/login/request-otp`
- `POST /api/auth/login/verify-otp`
- `POST /api/auth/password/request-reset-otp`
- `POST /api/auth/password/verify-reset-otp`
- `POST /api/auth/password/reset`
- `POST /api/auth/refresh`
- `POST /api/agent/{name}/chat`
- `WS /ws/{name}/{session_id}?token=<jwt>`

## First-pass tools

- `crm_search` (MySQL seeded data)
- `mitsumi_pricing` (fixture lookup)
- `web_search` (stub)
- `file_gen` (PDF)

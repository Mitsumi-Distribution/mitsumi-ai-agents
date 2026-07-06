# Mitsumi AI Agent Platform — PRD

## Architecture
FastAPI + MongoDB + Redis + arq | React 19 + Vite 6 + Tailwind 4 | AWS Bedrock Claude (Haiku/Sonnet/Opus)
25 tools, 4 dept agents, per-dept model config, token tracking, Redis caching, file upload, voice AI

## Latest (2026-04-23)

### Session: Notifications + Docs + Notes + New Tools
- **Notification sound**: Web Audio API chime (C5→E5) plays on every new notification
- **Documents & Notes panel**: Right sidebar in chat with Docs/Notes tabs, toggle button
- **Notes**: Per-chat notes with add/delete, timestamps, persisted in MongoDB
- **Artifacts**: Lists uploaded docs + generated files (PDFs, Excel) with download links
- **/docs slash command**: Type `/docs` in composer to reference uploaded documents
- **3 new tools**: `schedule_meeting` (create meetings + send invites), `data_comparison` (compare metrics), `task_creator` (create tasks from chat)
- **25 tools total** across all agents

## Key credentials
- Super admin: francis@mitsumidistribution.com / <set via SUPERADMIN_PASSWORD in .env>
- AWS Bedrock eu-west-3, Resend, Tavily, Google API configured

# Backend Overhaul Plan (Persistent Sessions + 3 Chat Instances)

## Goal
Persist chat sessions/history across refreshes and backend restarts using a Docker-friendly database, while supporting up to 3 sessions (chat instances) per client.

## Todo
- [x] Audit existing backend flow and identify integration points.
- [x] Add PostgreSQL support with docker-compose and environment config.
- [x] Create DB schema for sessions and messages with indexes.
- [x] Build DB access layer (init, queries, persistence helpers).
- [x] Enforce max 3 sessions per client.
- [x] Replace in-memory memory module with DB-backed session history.
- [x] Add endpoints to list sessions and fetch session history.
- [x] Update frontend API usage to restore latest session on refresh.
- [x] Build and test backend/frontend end-to-end.
- [x] Update docs (README) with Docker + DB run instructions.

## Progress Notes
- Initial audit complete. Existing session storage uses in-memory Map and loses history on process restart.
- Added Docker compose PostgreSQL service and `DATABASE_URL`/`MAX_SESSIONS_PER_CLIENT` env support.
- Added persistent session/message schema with indexes and auto-init at backend startup.
- Added session APIs:
	- `GET /api/chat/sessions?clientId=...`
	- `POST /api/chat/sessions`
	- `GET /api/chat/sessions/:sessionId/messages?clientId=...`
- Enforced max 3 sessions per client on session creation and chat auto-create.
- Frontend now tracks `clientId`, supports up to 3 chat instances, and restores session history on refresh.
- Backend tests pass and full repo build passes.
- Runtime note: Docker daemon was not running during verification (`docker compose up -d postgres` failed until Docker Desktop is started).

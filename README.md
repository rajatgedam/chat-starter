# Starter AI Chat (React + TypeScript + Express + PostgreSQL)

A full-stack chat app starter with persistent sessions, Hugging Face LLM integration, and a modern React UI.

Default LLM: `openai/gpt-oss-20b` via Hugging Face Router Chat Completions API.

## Current Capabilities

- Persistent chat history in PostgreSQL (survives refreshes and backend restarts)
- Up to 3 chat sessions per client (configurable)
- Left sidebar session switcher with auto-generated subject lines
- Rolling prompt memory window (last 8 turns sent as context)
- Hugging Face chat completion integration
- Automatic continuation when model output is cut by token limit
- Live usage telemetry in UI (prompt/completion/total tokens + remaining limit)
- Input validation, error handling, and backend tests

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Express + TypeScript
- Database: PostgreSQL (Docker Compose friendly)
- LLM provider: Hugging Face Router Chat Completions API

## Quick Start

### 1) Install dependencies

```bash
npm install
npm --prefix frontend install
npm --prefix backend install
```

### 2) Configure environment

```bash
cp backend/.env.example backend/.env
```

Update backend/.env with at least your Hugging Face key:

```env
HUGGINGFACE_API_KEY=hf_your_token_here
DATABASE_URL=postgres://chat:chat@localhost:5432/chatdb
MAX_SESSIONS_PER_CLIENT=3
```

### 3) Start PostgreSQL with Docker

```bash
docker compose up -d postgres
```

### 4) Build

```bash
npm run build
```

### 5) Run in development

```bash
npm run dev
```

Default local URLs:

- Frontend: http://localhost:5173 (or next free Vite port)
- Backend: http://localhost:3001

## Environment Variables (Backend)

Required:

- HUGGINGFACE_API_KEY
- DATABASE_URL

Optional:

- HUGGINGFACE_MODEL (default: openai/gpt-oss-20b)
- HUGGINGFACE_MAX_TOKENS (default: 900)
- MAX_SESSIONS_PER_CLIENT (default: 3)
- PORT (default: 3001)
- CORS_ORIGIN (default: *)

## Scripts

Root:

```bash
npm run dev
npm run build
npm run test
```

Backend:

```bash
npm --prefix backend run dev
npm --prefix backend run build
npm --prefix backend run test
```

Frontend:

```bash
npm --prefix frontend run dev
npm --prefix frontend run build
```

## API

### POST /api/chat

Sends a user message for a client/session and returns assistant reply plus usage metadata.

Request body:

```json
{
  "message": "Explain transformers simply",
  "clientId": "optional-client-id",
  "sessionId": "optional-session-id"
}
```

Response body:

```json
{
  "reply": "...",
  "clientId": "...",
  "sessionId": "...",
  "memoryTurns": 3,
  "usage": {
    "promptTokens": 120,
    "completionTokens": 210,
    "totalTokens": 330
  },
  "rateLimit": {
    "remainingTokens": 748701,
    "limitTokens": 750000,
    "resetTokensMs": 103,
    "remainingRequests": 1439999,
    "limitRequests": 1440000,
    "resetRequestsMs": 60
  }
}
```

Notes:

- If sessionId is not provided, backend creates one (subject to session limit).
- Returns 409 when client session limit is reached.

### GET /api/chat/sessions?clientId=...

Lists sessions for a client, newest first.

Response shape:

```json
{
  "sessions": [
    {
      "sessionId": "...",
      "clientId": "...",
      "title": "Plan my 7-day trip to Kyoto with food and…",
      "createdAt": "...",
      "updatedAt": "...",
      "messageCount": 2
    }
  ]
}
```

### POST /api/chat/sessions

Creates a new session for a client.

Request body:

```json
{
  "clientId": "optional-client-id"
}
```

Returns 409 when client already has max sessions.

### GET /api/chat/sessions/:sessionId/messages?clientId=...

Returns full message history for one session.

### GET /health

Returns:

```json
{ "status": "ok" }
```

## Frontend UX Features

- Sidebar chat list with short subject lines
- One-click switching between sessions
- New chat creation from sidebar
- Chat history restored automatically on refresh
- Bottom usage panel with token and limit telemetry

## Docker

Start DB:

```bash
docker compose up -d postgres
```

Check status:

```bash
docker compose ps
```

Stop:

```bash
docker compose down
```

## Known Limitations

- No user authentication yet
- No streaming token output yet (non-SSE responses)
- Client identity is browser-local (localStorage)

## Suggested Next Steps

1. Add auth and per-user server-side identity.
2. Add rename/delete session actions in sidebar.
3. Add retention policy and cleanup job for old sessions.
4. Add streaming responses via SSE.

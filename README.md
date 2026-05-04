# Starter AI Chat (React + TypeScript)

A simple ChatGPT-style starter app for learning AI integration and showcasing on GitHub.

## Quick Startup (Configure, Build, Run)

1. Install dependencies:

```bash
npm install
npm --prefix frontend install
npm --prefix backend install
```

2. Configure environment:

```bash
cp backend/.env.example backend/.env
```

Add your Hugging Face token to `backend/.env`:

```env
HUGGINGFACE_API_KEY=hf_your_token_here
```

3. Build the app:

```bash
npm run build
```

4. Run the app (development):

```bash
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:3001`

## What This Project Shows

- Full-stack chat flow with a React UI and Express API
- LLM integration through Hugging Face Router Chat Completions
- Short-term conversation memory (rolling window)
- Input validation and backend API tests

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Express + TypeScript
- Model API: Hugging Face Inference API (free tier)
- Memory: In-memory rolling window (last 8 turns per session)

## Project Structure

- `frontend`: React web app
- `backend`: Express API server
- `.env.example`: environment variable template

## Scripts

```bash
npm run dev      # run frontend + backend
npm run build    # build both projects
npm run test     # run backend tests
```

## API

### `POST /api/chat`

Request body:

```json
{
  "message": "Explain transformers simply",
  "sessionId": "optional-session-id"
}
```

Response body:

```json
{
  "reply": "...",
  "sessionId": "...",
  "memoryTurns": 3
}
```

### `GET /health`

Returns `{ "status": "ok" }`.

## Deployment

### Frontend (Vercel/Netlify)

- Build command: `npm --prefix frontend run build`
- Output directory: `frontend/dist`
- Environment variable: `VITE_API_BASE_URL=https://your-backend-url`

### Backend (Render/Railway/Fly)

- Start command: `npm --prefix backend run start`
- Build command: `npm --prefix backend run build`
- Required env vars:
  - `HUGGINGFACE_API_KEY`
  - `HUGGINGFACE_MODEL` (optional)
  - `PORT`
  - `CORS_ORIGIN`

## Limitations (Starter Scope)

- No persistent database
- No authentication
- No streaming responses
- Memory resets when backend restarts

## Next Improvements

1. Add streaming responses via SSE.
2. Add persistent storage (SQLite/PostgreSQL).
3. Add fallback provider for reliability.
4. Add login and per-user history.

## GitHub Checklist

- Add screenshots or a short demo GIF to this README
- Add your deployed frontend URL and backend URL
- Keep `backend/.env` out of source control

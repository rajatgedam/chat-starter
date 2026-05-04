import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { ChatMessage } from "../../types";

const MAX_TURNS = 8;
const DEFAULT_MAX_SESSIONS_PER_CLIENT = 3;

type SessionRecord = {
  sessionId: string;
  clientId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

const DEFAULT_SESSION_TITLE = "New chat";

function buildSessionTitle(message: string): string {
  const compact = message.replace(/\s+/g, " ").trim();
  if (!compact) {
    return DEFAULT_SESSION_TITLE;
  }

  const maxLength = 42;
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

type SessionStore = {
  init: () => Promise<void>;
  ensureSession: (clientId: string, sessionId?: string) => Promise<string>;
  getSessionHistory: (sessionId: string) => Promise<ChatMessage[]>;
  appendSessionTurn: (
    sessionId: string,
    userMessage: string,
    assistantMessage: string,
  ) => Promise<ChatMessage[]>;
  listSessions: (clientId: string) => Promise<SessionRecord[]>;
  getSessionMessages: (clientId: string, sessionId: string) => Promise<ChatMessage[]>;
  clearSessions: () => Promise<void>;
};

function maxSessionsPerClient(): number {
  const configured = Number(process.env.MAX_SESSIONS_PER_CLIENT ?? DEFAULT_MAX_SESSIONS_PER_CLIENT);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_MAX_SESSIONS_PER_CLIENT;
}

function normalizeClientId(clientId?: string): string {
  const trimmed = clientId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "default-client";
}

function createInMemoryStore(): SessionStore {
  const sessions = new Map<
    string,
    { clientId: string; title: string; createdAt: string; updatedAt: string }
  >();
  const messages = new Map<string, ChatMessage[]>();

  return {
    async init() {
      return;
    },
    async ensureSession(clientId: string, sessionId?: string) {
      const normalizedClient = normalizeClientId(clientId);
      const existingSessionId = sessionId?.trim();

      if (existingSessionId && sessions.has(existingSessionId)) {
        const existing = sessions.get(existingSessionId);
        if (existing?.clientId !== normalizedClient) {
          throw new Error("Session does not belong to this client.");
        }
        return existingSessionId;
      }

      const sessionCount = Array.from(sessions.values()).filter(
        (session) => session.clientId === normalizedClient,
      ).length;
      if (sessionCount >= maxSessionsPerClient()) {
        throw new Error(`Session limit reached (${maxSessionsPerClient()}).`);
      }

      const nextSessionId = existingSessionId ?? randomUUID();
      const now = new Date().toISOString();
      sessions.set(nextSessionId, {
        clientId: normalizedClient,
        title: DEFAULT_SESSION_TITLE,
        createdAt: now,
        updatedAt: now,
      });
      messages.set(nextSessionId, messages.get(nextSessionId) ?? []);

      return nextSessionId;
    },
    async getSessionHistory(sessionId: string) {
      const allMessages = messages.get(sessionId) ?? [];
      return allMessages.slice(-(MAX_TURNS * 2));
    },
    async appendSessionTurn(sessionId: string, userMessage: string, assistantMessage: string) {
      const existing = messages.get(sessionId) ?? [];
      const next: ChatMessage[] = [
        ...existing,
        { role: "user", content: userMessage },
        { role: "assistant", content: assistantMessage },
      ];
      messages.set(sessionId, next);

      const session = sessions.get(sessionId);
      if (session) {
        session.updatedAt = new Date().toISOString();
        if (session.title === DEFAULT_SESSION_TITLE) {
          session.title = buildSessionTitle(userMessage);
        }
      }

      return next.slice(-(MAX_TURNS * 2));
    },
    async listSessions(clientId: string) {
      const normalizedClient = normalizeClientId(clientId);
      const clientSessions = Array.from(sessions.entries())
        .filter(([, session]) => session.clientId === normalizedClient)
        .map(([sessionId, session]) => ({
          sessionId,
          clientId: session.clientId,
          title: session.title,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messageCount: messages.get(sessionId)?.length ?? 0,
        }))
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));

      return clientSessions;
    },
    async getSessionMessages(clientId: string, sessionId: string) {
      const normalizedClient = normalizeClientId(clientId);
      const session = sessions.get(sessionId);
      if (!session || session.clientId !== normalizedClient) {
        return [];
      }
      return messages.get(sessionId) ?? [];
    },
    async clearSessions() {
      sessions.clear();
      messages.clear();
    },
  };
}

function createPostgresStore(connectionString: string): SessionStore {
  const pool = new Pool({ connectionString });

  return {
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          session_id TEXT PRIMARY KEY,
          client_id TEXT NOT NULL,
          title TEXT NOT NULL DEFAULT 'New chat',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        ALTER TABLE chat_sessions
        ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'New chat';
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id BIGSERIAL PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_chat_sessions_client_updated
          ON chat_sessions (client_id, updated_at DESC);
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
          ON chat_messages (session_id, created_at ASC, id ASC);
      `);
    },
    async ensureSession(clientId: string, sessionId?: string) {
      const normalizedClient = normalizeClientId(clientId);
      const requestedSessionId = sessionId?.trim();

      if (requestedSessionId) {
        const existing = await pool.query<{ client_id: string }>(
          `SELECT client_id FROM chat_sessions WHERE session_id = $1`,
          [requestedSessionId],
        );

        if (existing.rowCount && existing.rows[0].client_id !== normalizedClient) {
          throw new Error("Session does not belong to this client.");
        }

        if (existing.rowCount) {
          return requestedSessionId;
        }
      }

      const countResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM chat_sessions WHERE client_id = $1`,
        [normalizedClient],
      );

      const count = Number(countResult.rows[0]?.count ?? "0");
      if (count >= maxSessionsPerClient()) {
        throw new Error(`Session limit reached (${maxSessionsPerClient()}).`);
      }

      const nextSessionId = requestedSessionId ?? randomUUID();
      await pool.query(
        `INSERT INTO chat_sessions (session_id, client_id) VALUES ($1, $2)
         ON CONFLICT (session_id) DO NOTHING`,
        [nextSessionId, normalizedClient],
      );

      return nextSessionId;
    },
    async getSessionHistory(sessionId: string) {
      const result = await pool.query<{ role: ChatMessage["role"]; content: string }>(
        `SELECT role, content
         FROM chat_messages
         WHERE session_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT $2`,
        [sessionId, MAX_TURNS * 2],
      );

      return result.rows.reverse().map((row) => ({ role: row.role, content: row.content }));
    },
    async appendSessionTurn(sessionId: string, userMessage: string, assistantMessage: string) {
      await pool.query(
        `INSERT INTO chat_messages (session_id, role, content)
         VALUES ($1, 'user', $2), ($1, 'assistant', $3)`,
        [sessionId, userMessage, assistantMessage],
      );

      await pool.query(
        `UPDATE chat_sessions
         SET updated_at = NOW(),
             title = CASE
               WHEN title = $2 THEN $3
               ELSE title
             END
         WHERE session_id = $1`,
        [sessionId, DEFAULT_SESSION_TITLE, buildSessionTitle(userMessage)],
      );

      return this.getSessionHistory(sessionId);
    },
    async listSessions(clientId: string) {
      const normalizedClient = normalizeClientId(clientId);
      const result = await pool.query<SessionRecord>(
        `SELECT
           s.session_id AS "sessionId",
           s.client_id AS "clientId",
           s.title AS "title",
           s.created_at::text AS "createdAt",
           s.updated_at::text AS "updatedAt",
           COUNT(m.id)::int AS "messageCount"
         FROM chat_sessions s
         LEFT JOIN chat_messages m ON m.session_id = s.session_id
         WHERE s.client_id = $1
         GROUP BY s.session_id, s.client_id, s.created_at, s.updated_at
         ORDER BY s.updated_at DESC`,
        [normalizedClient],
      );

      return result.rows;
    },
    async getSessionMessages(clientId: string, sessionId: string) {
      const normalizedClient = normalizeClientId(clientId);
      const accessResult = await pool.query<{ session_id: string }>(
        `SELECT session_id FROM chat_sessions WHERE session_id = $1 AND client_id = $2`,
        [sessionId, normalizedClient],
      );

      if (!accessResult.rowCount) {
        return [];
      }

      const result = await pool.query<{ role: ChatMessage["role"]; content: string }>(
        `SELECT role, content
         FROM chat_messages
         WHERE session_id = $1
         ORDER BY created_at ASC, id ASC`,
        [sessionId],
      );

      return result.rows.map((row) => ({ role: row.role, content: row.content }));
    },
    async clearSessions() {
      await pool.query(`TRUNCATE TABLE chat_messages, chat_sessions RESTART IDENTITY CASCADE`);
    },
  };
}

const configuredDatabaseUrl = process.env.DATABASE_URL?.trim();
const store = configuredDatabaseUrl
  ? createPostgresStore(configuredDatabaseUrl)
  : createInMemoryStore();

let initPromise: Promise<void> | null = null;

async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = store.init();
  }

  return initPromise;
}

export async function initSessionStore(): Promise<void> {
  await ensureInitialized();
}

export async function ensureSession(clientId: string, sessionId?: string): Promise<string> {
  await ensureInitialized();
  return store.ensureSession(clientId, sessionId);
}

export async function getSessionHistory(sessionId: string): Promise<ChatMessage[]> {
  await ensureInitialized();
  return store.getSessionHistory(sessionId);
}

export async function appendSessionTurn(
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
): Promise<ChatMessage[]> {
  await ensureInitialized();
  return store.appendSessionTurn(sessionId, userMessage, assistantMessage);
}

export async function listSessions(clientId: string): Promise<SessionRecord[]> {
  await ensureInitialized();
  return store.listSessions(clientId);
}

export async function getSessionMessages(clientId: string, sessionId: string): Promise<ChatMessage[]> {
  await ensureInitialized();
  return store.getSessionMessages(clientId, sessionId);
}

export async function clearSessions(): Promise<void> {
  await ensureInitialized();
  await store.clearSessions();
}

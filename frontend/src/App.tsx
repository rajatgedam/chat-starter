import { useEffect, useMemo, useState } from "react";
import { ChatInput } from "./components/ChatInput";
import { ChatWindow } from "./components/ChatWindow";
import {
  createSession,
  getSessionMessages,
  listClientSessions,
  sendMessage,
  type ChatMessage,
  type SessionSummary,
} from "./services/chatApi";
import "./App.css";

const SESSION_KEY = "ai-chat-session-id";
const CLIENT_KEY = "ai-chat-client-id";
const USAGE_SNAPSHOT_KEY = "ai-chat-last-usage-snapshot";
const MAX_SESSIONS = Number(import.meta.env.VITE_MAX_SESSIONS ?? 3);

type UsageSnapshot = {
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  rateLimit: {
    remainingTokens?: number;
    limitTokens?: number;
    resetTokensMs?: number;
    remainingRequests?: number;
    limitRequests?: number;
    resetRequestsMs?: number;
  } | null;
  capturedAt: number;
};

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memoryTurns, setMemoryTurns] = useState(0);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [lastUsage, setLastUsage] = useState<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null>(null);
  const [lastRateLimit, setLastRateLimit] = useState<{
    remainingTokens?: number;
    limitTokens?: number;
    resetTokensMs?: number;
    remainingRequests?: number;
    limitRequests?: number;
    resetRequestsMs?: number;
  } | null>(null);

  const clientId = useMemo(() => {
    const existing = localStorage.getItem(CLIENT_KEY);
    if (existing) {
      return existing;
    }

    const next = crypto.randomUUID();
    localStorage.setItem(CLIENT_KEY, next);
    return next;
  }, []);

  const sessionId = useMemo(() => {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) {
      return existing;
    }
    const next = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, next);
    return next;
  }, []);

  const [activeSessionId, setActiveSessionId] = useState(sessionId);
  const canCreateSession = sessions.length < MAX_SESSIONS;
  const hasKnownTokenExhaustion = (lastRateLimit?.remainingTokens ?? 1) <= 0;

  useEffect(() => {
    let isMounted = true;

    async function loadSessionState() {
      setIsLoadingHistory(true);
      setError(null);

      try {
        const [fetchedSessions, restoredMessages] = await Promise.all([
          listClientSessions(clientId),
          getSessionMessages(clientId, activeSessionId),
        ]);

        if (!isMounted) {
          return;
        }

        setSessions(fetchedSessions);
        setMessages(restoredMessages);
        setMemoryTurns(Math.floor(restoredMessages.length / 2));
      } catch (err) {
        if (!isMounted) {
          return;
        }

        const details = err instanceof Error ? err.message : "Unknown error";
        setError(details);
      } finally {
        if (isMounted) {
          setIsLoadingHistory(false);
        }
      }
    }

    void loadSessionState();

    return () => {
      isMounted = false;
    };
  }, [activeSessionId, clientId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(USAGE_SNAPSHOT_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as UsageSnapshot;
      if (parsed?.usage) {
        setLastUsage(parsed.usage);
      }
      if (parsed?.rateLimit) {
        setLastRateLimit(parsed.rateLimit);
      }
    } catch {
      // Ignore corrupted local snapshot data.
    }
  }, []);

  function persistUsageSnapshot(
    usage: UsageSnapshot["usage"],
    rateLimit: UsageSnapshot["rateLimit"],
  ) {
    const snapshot: UsageSnapshot = {
      usage,
      rateLimit,
      capturedAt: Date.now(),
    };
    localStorage.setItem(USAGE_SNAPSHOT_KEY, JSON.stringify(snapshot));
  }

  async function handleSend(message: string) {
    if (hasKnownTokenExhaustion) {
      setError("Last known token quota is exhausted. Wait for reset or top up quota before sending.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: message }]);

    try {
      const response = await sendMessage(message, clientId, activeSessionId);

      localStorage.setItem(SESSION_KEY, response.sessionId);
      setActiveSessionId(response.sessionId);
      setMemoryTurns(response.memoryTurns);
      setLastUsage(response.usage ?? null);
      setLastRateLimit(response.rateLimit ?? null);
      persistUsageSnapshot(response.usage ?? null, response.rateLimit ?? null);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.reply },
      ]);
      const nextSessions = await listClientSessions(clientId);
      setSessions(nextSessions);
    } catch (err) {
      const details = err instanceof Error ? err.message : "Unknown error";
      setError(details);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateSession() {
    setError(null);
    try {
      const result = await createSession(clientId);
      localStorage.setItem(SESSION_KEY, result.sessionId);
      setActiveSessionId(result.sessionId);
      setSessions(result.sessions);
      setMessages([]);
      setMemoryTurns(0);
    } catch (err) {
      const details = err instanceof Error ? err.message : "Unknown error";
      setError(details);
    }
  }

  function handleSwitchSession(nextSessionId: string) {
    localStorage.setItem(SESSION_KEY, nextSessionId);
    setActiveSessionId(nextSessionId);
  }

  return (
    <main className="app">
      <aside
        id="chat-sidebar"
        className={`chat-sidebar ${isSidebarOpen ? "open" : "closed"}`}
        aria-label="Chats"
        aria-hidden={!isSidebarOpen}
      >
        <div className="sidebar-top">
          <div>
            <p className="eyebrow">Chats</p>
            <p className="sidebar-meta">
              {sessions.length}/{MAX_SESSIONS} active
            </p>
          </div>
          <button
            type="button"
            className="session-pill session-create"
            onClick={handleCreateSession}
            disabled={isLoading || isLoadingHistory || !canCreateSession}
            title={!canCreateSession ? "Session limit reached" : "Create new chat"}
          >
            + New Chat
          </button>
        </div>

        <nav className="session-list" aria-label="Chat sessions">
          {sessions.length === 0 ? (
            <p className="session-empty">No chats yet. Start by creating one.</p>
          ) : null}
          {sessions.map((session, index) => (
            <button
              key={session.sessionId}
              type="button"
              className={`session-item ${session.sessionId === activeSessionId ? "active" : ""}`}
              onClick={() => handleSwitchSession(session.sessionId)}
              disabled={isLoading || isLoadingHistory}
              title={`Messages: ${session.messageCount}`}
            >
              <span className="session-title">{session.title || `Chat ${index + 1}`}</span>
              <span className="session-meta">{Math.floor(session.messageCount / 2)} turns</span>
            </button>
          ))}
        </nav>

        <aside className="quota-panel sidebar-quota" aria-live="polite" aria-label="Token usage">
          <p className="quota-title">Hugging Face usage</p>
          <p className="quota-line quota-status">
            Last known status before next request: {hasKnownTokenExhaustion ? "Out of tokens" : "Tokens available"}
          </p>
          {lastUsage ? (
            <p className="quota-line">
              Last response: {lastUsage.totalTokens} tokens ({lastUsage.promptTokens} prompt +{" "}
              {lastUsage.completionTokens} completion)
            </p>
          ) : (
            <p className="quota-line">Last response: not available yet</p>
          )}
          <p className="quota-line">
            Remaining tokens: {lastRateLimit?.remainingTokens ?? "n/a"}
            {lastRateLimit?.limitTokens ? ` / ${lastRateLimit.limitTokens}` : ""}
          </p>
          <p className="quota-line">
            Reset: {lastRateLimit?.resetTokensMs !== undefined ? `${lastRateLimit.resetTokensMs}ms` : "n/a"}
          </p>
        </aside>
      </aside>

      <section className="chat-main">
        <div className="layout-actions">
          <button
            type="button"
            className="toggle-sidebar"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            aria-controls="chat-sidebar"
            aria-expanded={isSidebarOpen}
          >
            {isSidebarOpen ? "Hide chats" : "Show chats"}
          </button>
        </div>

        <header className="hero">
          <p className="eyebrow">Learning Project</p>
          <h1>Starter AI Chat</h1>
          <p className="subtitle">
            React + TypeScript frontend, Express backend, Hugging Face Inference.
          </p>
          <p className="memory-note">Memory window: {memoryTurns} turns</p>
        </header>

        <ChatWindow messages={messages} isLoading={isLoading} />

        {error ? <p className="error">Error: {error}</p> : null}

        <ChatInput disabled={isLoading || isLoadingHistory} onSubmit={handleSend} />
      </section>
    </main>
  );
}

export default App;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatResponse = {
  reply: string;
  clientId: string;
  sessionId: string;
  memoryTurns: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  rateLimit?: {
    remainingTokens?: number;
    limitTokens?: number;
    resetTokensMs?: number;
    remainingRequests?: number;
    limitRequests?: number;
    resetRequestsMs?: number;
  };
};

export type SessionSummary = {
  sessionId: string;
  clientId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:3001";

export async function sendMessage(
  message: string,
  clientId: string,
  sessionId?: string,
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionId ? { "x-session-id": sessionId } : {}),
      "x-client-id": clientId,
    },
    body: JSON.stringify({ message, sessionId, clientId }),
  });

  const data = (await response.json()) as Partial<ChatResponse> & {
    error?: string;
    details?: string;
  };

  if (!response.ok || !data.reply || !data.sessionId || !data.clientId) {
    const detail = [data.error, data.details].filter(Boolean).join(" ").trim();
    throw new Error(detail || "Request failed");
  }

  return {
    reply: data.reply,
    clientId: data.clientId,
    sessionId: data.sessionId,
    memoryTurns: data.memoryTurns ?? 0,
    usage: data.usage,
    rateLimit: data.rateLimit,
  };
}

export async function listClientSessions(clientId: string): Promise<SessionSummary[]> {
  const response = await fetch(
    `${API_BASE}/api/chat/sessions?clientId=${encodeURIComponent(clientId)}`,
  );

  const data = (await response.json()) as {
    sessions?: SessionSummary[];
    error?: string;
    details?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || data.details || "Failed to load sessions");
  }

  return data.sessions ?? [];
}

export async function createSession(clientId: string): Promise<{ sessionId: string; sessions: SessionSummary[] }> {
  const response = await fetch(`${API_BASE}/api/chat/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId,
    },
    body: JSON.stringify({ clientId }),
  });

  const data = (await response.json()) as {
    sessionId?: string;
    sessions?: SessionSummary[];
    error?: string;
    details?: string;
  };

  if (!response.ok || !data.sessionId) {
    throw new Error(data.error || data.details || "Failed to create session");
  }

  return {
    sessionId: data.sessionId,
    sessions: data.sessions ?? [],
  };
}

export async function getSessionMessages(
  clientId: string,
  sessionId: string,
): Promise<ChatMessage[]> {
  const response = await fetch(
    `${API_BASE}/api/chat/sessions/${encodeURIComponent(sessionId)}/messages?clientId=${encodeURIComponent(clientId)}`,
  );

  const data = (await response.json()) as {
    messages?: ChatMessage[];
    error?: string;
    details?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || data.details || "Failed to load messages");
  }

  return data.messages ?? [];
}

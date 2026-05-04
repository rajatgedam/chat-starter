export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatResponse = {
  reply: string;
  sessionId: string;
  memoryTurns: number;
};

const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:3001";

export async function sendMessage(
  message: string,
  sessionId?: string,
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionId ? { "x-session-id": sessionId } : {}),
    },
    body: JSON.stringify({ message, sessionId }),
  });

  const data = (await response.json()) as Partial<ChatResponse> & {
    error?: string;
  };

  if (!response.ok || !data.reply || !data.sessionId) {
    throw new Error(data.error || "Request failed");
  }

  return {
    reply: data.reply,
    sessionId: data.sessionId,
    memoryTurns: data.memoryTurns ?? 0,
  };
}

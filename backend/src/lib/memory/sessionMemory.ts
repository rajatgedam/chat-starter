import type { ChatMessage } from "../../types";

const MAX_TURNS = 8;
const sessionStore = new Map<string, ChatMessage[]>();

export function getSessionHistory(sessionId: string): ChatMessage[] {
  return sessionStore.get(sessionId) ?? [];
}

export function appendSessionTurn(
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
): ChatMessage[] {
  const existing = getSessionHistory(sessionId);
  const next: ChatMessage[] = [
    ...existing,
    { role: "user", content: userMessage },
    { role: "assistant", content: assistantMessage },
  ];

  const maxMessages = MAX_TURNS * 2;
  const trimmed = next.slice(-maxMessages);
  sessionStore.set(sessionId, trimmed);
  return trimmed;
}

export function clearSessions(): void {
  sessionStore.clear();
}

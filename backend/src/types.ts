export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatRequestBody = {
  message?: string;
  sessionId?: string;
  clientId?: string;
};

export type SessionSummary = {
  sessionId: string;
  clientId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export type ChatUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type ChatRateLimit = {
  remainingTokens?: number;
  limitTokens?: number;
  resetTokensMs?: number;
  remainingRequests?: number;
  limitRequests?: number;
  resetRequestsMs?: number;
};

export type ChatProviderResult = {
  reply: string;
  usage?: ChatUsage;
  rateLimit?: ChatRateLimit;
};

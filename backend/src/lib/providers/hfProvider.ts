import type { ChatMessage, ChatProviderResult, ChatRateLimit, ChatUsage } from "../../types";

const CHAT_COMPLETIONS_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";
const DEFAULT_MAX_TOKENS = 900;
const MAX_CONTINUATIONS = 2;
const CONTINUE_PROMPT =
  "Continue from exactly where you stopped. Do not repeat any previous text.";

function buildMessages(messages: ChatMessage[], userMessage: string): ChatMessage[] {
  const systemPrompt: ChatMessage = {
    role: "system",
    content:
      "You are a helpful assistant. Keep answers concise, practical, and easy for beginners.",
  };

  return [systemPrompt, ...messages, { role: "user", content: userMessage }];
}

function parseNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function extractRateLimit(headers?: Pick<Headers, "get"> | null): ChatRateLimit | undefined {
  if (!headers) {
    return undefined;
  }

  const rateLimit: ChatRateLimit = {
    remainingTokens: parseNumber(headers.get("x-ratelimit-remaining-tokens")),
    limitTokens: parseNumber(headers.get("x-ratelimit-limit-tokens")),
    resetTokensMs: parseNumber(headers.get("x-ratelimit-reset-tokens")),
    remainingRequests: parseNumber(headers.get("x-ratelimit-remaining-requests")),
    limitRequests: parseNumber(headers.get("x-ratelimit-limit-requests")),
    resetRequestsMs: parseNumber(headers.get("x-ratelimit-reset-requests")),
  };

  if (Object.values(rateLimit).every((value) => value === undefined)) {
    return undefined;
  }

  return rateLimit;
}

function extractChoice(payload: unknown): {
  reply: string | null;
  finishReason: string | null;
  usage?: ChatUsage;
} {
  const candidate = payload as {
    choices?: Array<{
      message?: { content?: string };
      finish_reason?: string;
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  const firstChoice = candidate.choices?.[0];
  const content = firstChoice?.message?.content;
  const finishReason = firstChoice?.finish_reason;

  const promptTokens = candidate.usage?.prompt_tokens;
  const completionTokens = candidate.usage?.completion_tokens;
  const totalTokens = candidate.usage?.total_tokens;
  const usage =
    typeof promptTokens === "number" &&
    typeof completionTokens === "number" &&
    typeof totalTokens === "number"
      ? {
          promptTokens,
          completionTokens,
          totalTokens,
        }
      : undefined;

  return {
    reply: typeof content === "string" ? content.trim() : null,
    finishReason: typeof finishReason === "string" ? finishReason : null,
    usage,
  };
}

async function requestCompletion(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<{
  reply: string;
  finishReason: string | null;
  usage?: ChatUsage;
  rateLimit?: ChatRateLimit;
}> {
  const response = await fetch(CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Hugging Face request failed (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as unknown;
  const { reply, finishReason, usage } = extractChoice(data);

  if (!reply) {
    throw new Error("Model returned an empty response.");
  }

  return {
    reply,
    finishReason,
    usage,
    rateLimit: extractRateLimit(response.headers),
  };
}

export async function askHuggingFace(
  messages: ChatMessage[],
  userMessage: string,
): Promise<ChatProviderResult> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing HUGGINGFACE_API_KEY.");
  }

  const model = process.env.HUGGINGFACE_MODEL ?? DEFAULT_MODEL;
  const maxTokens = Number(process.env.HUGGINGFACE_MAX_TOKENS ?? DEFAULT_MAX_TOKENS);
  const effectiveMaxTokens =
    Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : DEFAULT_MAX_TOKENS;
  let chatMessages = buildMessages(messages, userMessage);
  const replyParts: string[] = [];
  let aggregatedUsage: ChatUsage | undefined;
  let latestRateLimit: ChatRateLimit | undefined;

  for (let index = 0; index <= MAX_CONTINUATIONS; index += 1) {
    const { reply, finishReason, usage, rateLimit } = await requestCompletion(
      apiKey,
      model,
      chatMessages,
      effectiveMaxTokens,
    );

    replyParts.push(reply);

    if (usage) {
      aggregatedUsage = {
        promptTokens: (aggregatedUsage?.promptTokens ?? 0) + usage.promptTokens,
        completionTokens: (aggregatedUsage?.completionTokens ?? 0) + usage.completionTokens,
        totalTokens: (aggregatedUsage?.totalTokens ?? 0) + usage.totalTokens,
      };
    }

    if (rateLimit) {
      latestRateLimit = rateLimit;
    }

    if (finishReason !== "length") {
      break;
    }

    chatMessages = [
      ...chatMessages,
      { role: "assistant", content: reply },
      { role: "user", content: CONTINUE_PROMPT },
    ];
  }

  return {
    reply: replyParts.join("\n\n").trim(),
    usage: aggregatedUsage,
    rateLimit: latestRateLimit,
  };
}

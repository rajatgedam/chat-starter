import type { ChatMessage } from "../../types";

const CHAT_COMPLETIONS_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";

function buildMessages(messages: ChatMessage[], userMessage: string): ChatMessage[] {
  const systemPrompt: ChatMessage = {
    role: "system",
    content:
      "You are a helpful assistant. Keep answers concise, practical, and easy for beginners.",
  };

  return [systemPrompt, ...messages, { role: "user", content: userMessage }];
}

function extractReply(payload: unknown): string | null {
  const candidate = payload as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = candidate.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : null;
}

export async function askHuggingFace(
  messages: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing HUGGINGFACE_API_KEY.");
  }

  const model = process.env.HUGGINGFACE_MODEL ?? DEFAULT_MODEL;
  const chatMessages = buildMessages(messages, userMessage);

  const response = await fetch(CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: chatMessages,
      max_tokens: 350,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Hugging Face request failed (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as unknown;
  const reply = extractReply(data);

  if (!reply) {
    throw new Error("Model returned an empty response.");
  }

  return reply;
}

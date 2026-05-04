import { Router } from "express";
import { randomUUID } from "node:crypto";
import {
  ensureSession,
  getSessionHistory,
  appendSessionTurn,
  getSessionMessages,
  listSessions,
} from "../lib/memory/sessionMemory";
import { askHuggingFace } from "../lib/providers/hfProvider";
import type { ChatRequestBody } from "../types";

const MAX_MESSAGE_LENGTH = 2000;

export const chatRouter = Router();

function resolveClientId(req: { body?: ChatRequestBody; header: (key: string) => string | undefined }) {
  return req.body?.clientId?.trim() || req.header("x-client-id") || "default-client";
}

chatRouter.get("/sessions", async (req, res) => {
  try {
    const clientId = (req.query.clientId as string | undefined)?.trim() || "default-client";
    const sessions = await listSessions(clientId);
    return res.status(200).json({ sessions });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Failed to load sessions.", details });
  }
});

chatRouter.post("/sessions", async (req, res) => {
  try {
    const body = req.body as ChatRequestBody | undefined;
    const clientId = body?.clientId?.trim() || req.header("x-client-id") || "default-client";
    const sessionId = await ensureSession(clientId);
    const sessions = await listSessions(clientId);
    return res.status(201).json({ sessionId, sessions });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    const status = details.includes("Session limit reached") ? 409 : 500;
    return res.status(status).json({ error: "Failed to create session.", details });
  }
});

chatRouter.get("/sessions/:sessionId/messages", async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const clientId = (req.query.clientId as string | undefined)?.trim() || "default-client";
    const messages = await getSessionMessages(clientId, sessionId);
    return res.status(200).json({ sessionId, messages });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Failed to load session messages.", details });
  }
});

chatRouter.post("/", async (req, res) => {
  const body = req.body as ChatRequestBody;
  const rawMessage = body?.message ?? "";
  const message = rawMessage.trim();

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
    });
  }

  const requestedSessionId = body?.sessionId?.trim() || req.header("x-session-id") || randomUUID();
  const clientId = resolveClientId(req);

  try {
    const sessionId = await ensureSession(clientId, requestedSessionId);
    const history = await getSessionHistory(sessionId);
    const providerResult = await askHuggingFace(history, message);
    const updatedHistory = await appendSessionTurn(sessionId, message, providerResult.reply);

    return res.status(200).json({
      reply: providerResult.reply,
      clientId,
      sessionId,
      memoryTurns: Math.floor(updatedHistory.length / 2),
      usage: providerResult.usage,
      rateLimit: providerResult.rateLimit,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    const status = details.includes("Session limit reached") ? 409 : 502;
    const errorMessage =
      status === 409 ? "Session limit reached for this client." : "Failed to get response from model provider.";
    return res.status(status).json({
      error: errorMessage,
      details,
    });
  }
});

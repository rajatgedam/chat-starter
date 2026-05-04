import { Router } from "express";
import { randomUUID } from "node:crypto";
import { getSessionHistory, appendSessionTurn } from "../lib/memory/sessionMemory";
import { askHuggingFace } from "../lib/providers/hfProvider";
import type { ChatRequestBody } from "../types";

const MAX_MESSAGE_LENGTH = 2000;

export const chatRouter = Router();

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

  const sessionId = body?.sessionId?.trim() || req.header("x-session-id") || randomUUID();

  try {
    const history = getSessionHistory(sessionId);
    const reply = await askHuggingFace(history, message);
    const updatedHistory = appendSessionTurn(sessionId, message, reply);

    return res.status(200).json({
      reply,
      sessionId,
      memoryTurns: Math.floor(updatedHistory.length / 2),
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({
      error: "Failed to get response from model provider.",
      details,
    });
  }
});

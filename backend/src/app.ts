import express from "express";
import cors from "cors";
import { chatRouter } from "./routes/chat";
import { healthRouter } from "./routes/health";

export function buildApp() {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((value) => value.trim())
    : "*";

  app.use(
    cors({
      origin: corsOrigin,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => {
    res.json({ name: "chat-backend", message: "API is running" });
  });

  app.use("/health", healthRouter);
  app.use("/api/chat", chatRouter);

  return app;
}

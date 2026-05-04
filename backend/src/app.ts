import express from "express";
import cors from "cors";
import { chatRouter } from "./routes/chat";
import { healthRouter } from "./routes/health";

export function buildApp() {
  const app = express();
  const configuredCorsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((value) => value.trim()).filter(Boolean)
    : [];
  const allowAnyLocalhost = process.env.NODE_ENV !== "production";

  const corsOrigin: cors.CorsOptions["origin"] = (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (configuredCorsOrigins.includes("*") || configuredCorsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    if (allowAnyLocalhost) {
      try {
        const url = new URL(origin);
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
          callback(null, true);
          return;
        }
      } catch {
        // Ignore malformed origins and fall through to rejection.
      }
    }

    callback(new Error("Not allowed by CORS"));
  };

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

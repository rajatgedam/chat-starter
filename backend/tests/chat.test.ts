import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app";
import { clearSessions } from "../src/lib/memory/sessionMemory";

describe("POST /api/chat", () => {
  afterEach(() => {
    clearSessions();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.HUGGINGFACE_API_KEY;
  });

  it("returns a model reply and session id", async () => {
    process.env.HUGGINGFACE_API_KEY = "fake-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "Sure, here is a response.",
              },
            },
          ],
        }),
      }),
    );

    const app = buildApp();
    const response = await request(app)
      .post("/api/chat")
      .send({ message: "Hello" })
      .expect(200);

    expect(response.body.reply).toContain("response");
    expect(response.body.sessionId).toBeTypeOf("string");
    expect(response.body.memoryTurns).toBe(1);
  });

  it("rejects empty message", async () => {
    const app = buildApp();
    const response = await request(app)
      .post("/api/chat")
      .send({ message: "   " })
      .expect(400);

    expect(response.body.error).toContain("Message is required");
  });

  it("returns provider failure details", async () => {
    process.env.HUGGINGFACE_API_KEY = "fake-key";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Rate limit",
      }),
    );

    const app = buildApp();
    const response = await request(app)
      .post("/api/chat")
      .send({ message: "Hello" })
      .expect(502);

    expect(response.body.error).toContain("Failed to get response");
    expect(response.body.details).toContain("429");
  });
});

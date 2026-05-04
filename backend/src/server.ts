import dotenv from "dotenv";
import { buildApp } from "./app";
import { initSessionStore } from "./lib/memory/sessionMemory";

dotenv.config();

async function startServer() {
  await initSessionStore();

  const app = buildApp();
  const port = Number(process.env.PORT ?? 3001);

  app.listen(port, () => {
    console.log(`Backend running at http://localhost:${port}`);
  });
}

void startServer();

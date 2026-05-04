import { useMemo, useState } from "react";
import { ChatInput } from "./components/ChatInput";
import { ChatWindow } from "./components/ChatWindow";
import { sendMessage, type ChatMessage } from "./services/chatApi";
import "./App.css";

const SESSION_KEY = "ai-chat-session-id";

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memoryTurns, setMemoryTurns] = useState(0);

  const sessionId = useMemo(() => {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) {
      return existing;
    }
    const next = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, next);
    return next;
  }, []);

  async function handleSend(message: string) {
    setIsLoading(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: message }]);

    try {
      const response = await sendMessage(message, sessionId);

      localStorage.setItem(SESSION_KEY, response.sessionId);
      setMemoryTurns(response.memoryTurns);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.reply },
      ]);
    } catch (err) {
      const details = err instanceof Error ? err.message : "Unknown error";
      setError(details);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <p className="eyebrow">Learning Project</p>
        <h1>Starter AI Chat</h1>
        <p className="subtitle">
          React + TypeScript frontend, Express backend, Hugging Face Inference.
        </p>
        <p className="memory-note">Memory window: {memoryTurns} turns</p>
      </header>

      <ChatWindow messages={messages} isLoading={isLoading} />

      {error ? <p className="error">Error: {error}</p> : null}

      <ChatInput disabled={isLoading} onSubmit={handleSend} />
    </main>
  );
}

export default App;

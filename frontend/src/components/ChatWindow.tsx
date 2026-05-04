import type { ChatMessage } from "../services/chatApi";

type ChatWindowProps = {
  messages: ChatMessage[];
  isLoading: boolean;
};

export function ChatWindow({ messages, isLoading }: ChatWindowProps) {
  return (
    <section className="chat-window" aria-live="polite" aria-label="Conversation">
      {messages.length === 0 ? (
        <p className="empty-state">Ask anything to start the conversation.</p>
      ) : null}

      {messages.map((message, index) => (
        <article key={`${message.role}-${index}`} className={`message message-${message.role}`}>
          <span className="message-role">{message.role}</span>
          <p>{message.content}</p>
        </article>
      ))}

      {isLoading ? (
        <article className="message message-assistant typing">
          <span className="message-role">assistant</span>
          <p>Thinking...</p>
        </article>
      ) : null}
    </section>
  );
}

import { useState, type FormEvent } from "react";

type ChatInputProps = {
  disabled?: boolean;
  onSubmit: (message: string) => Promise<void>;
};

export function ChatInput({ disabled = false, onSubmit }: ChatInputProps) {
  const [value, setValue] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = value.trim();
    if (!next || disabled) {
      return;
    }

    setValue("");
    await onSubmit(next);
  }

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Ask about AI, code, or anything you are learning..."
        rows={3}
        maxLength={2000}
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || value.trim().length === 0}>
        Send
      </button>
    </form>
  );
}

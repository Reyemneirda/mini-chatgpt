import { useState, useRef, useEffect } from 'react';
import './ChatInput.css';

interface Props {
  onSend: (content: string) => void;
  onCancel: () => void;
  disabled: boolean;
  sending: boolean;
}

export function ChatInput({ onSend, onCancel, disabled, sending }: Props) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || disabled) return;

    onSend(content.trim());
    setContent('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
        disabled={disabled}
        rows={3}
        aria-label="Message input"
      />
      <div className="chat-input-actions">
        {sending ? (
          <button
            type="button"
            onClick={onCancel}
            className="btn-cancel"
            aria-label="Cancel"
          >
            Cancel
          </button>
        ) : (
          <button
            type="submit"
            disabled={!content.trim() || disabled}
            className="btn-send"
            aria-label="Send message"
          >
            Send
          </button>
        )}
      </div>
    </form>
  );
}

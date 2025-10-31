import { useState, useRef, useEffect } from 'react';
import { ConversationDetail } from '../types';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import './ChatArea.css';

interface Props {
  conversation: ConversationDetail;
  onSendMessage: (content: string, abortSignal: AbortSignal) => Promise<void>;
  onError: (error: string) => void;
}

export function ChatArea({ conversation, onSendMessage, onError }: Props) {
  const [sending, setSending] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  async function handleSend(content: string) {
    if (sending) return;

    setSending(true);
    abortControllerRef.current = new AbortController();

    try {
      await onSendMessage(content, abortControllerRef.current.signal);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        onError(err.message || 'Failed to send message');
      }
    } finally {
      setSending(false);
      abortControllerRef.current = null;
    }
  }

  function handleCancel() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setSending(false);
      abortControllerRef.current = null;
    }
  }

  return (
    <div className="chat-area">
      <div className="chat-header">
        <h2>{conversation.title}</h2>
      </div>

      <MessageList messages={conversation.messages} />

      <ChatInput
        onSend={handleSend}
        onCancel={handleCancel}
        disabled={sending}
        sending={sending}
      />
    </div>
  );
}

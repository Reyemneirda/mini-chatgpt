import { useEffect, useRef } from 'react';
import { Message } from '../types';
import './MessageList.css';

interface Props {
  messages: Message[];
}

export function MessageList({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="message-list empty">
        <p>No messages yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((msg) => (
        <div key={msg.id} className={`message ${msg.role}`}>
          <div className="message-role">{msg.role === 'user' ? 'You' : 'Assistant'}</div>
          <div className="message-content">{msg.content}</div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  lastMessageAt: string | null;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  messages: Message[];
  pageInfo: {
    nextCursor: string | null;
    prevCursor: string | null;
  };
}

export interface SendMessageResponse {
  message: Message;
  reply: Message;
}

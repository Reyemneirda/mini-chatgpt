import { Conversation, ConversationDetail, SendMessageResponse } from './types';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, error.error || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  async createConversation(): Promise<Conversation> {
    return fetchApi(`${API_BASE}/conversations`, {
      method: 'POST',
    });
  },

  async listConversations(): Promise<Conversation[]> {
    return fetchApi(`${API_BASE}/conversations`);
  },

  async getConversation(
    id: string,
    messagesCursor?: string,
    limit: number = 50
  ): Promise<ConversationDetail> {
    const params = new URLSearchParams();
    if (messagesCursor) params.set('messagesCursor', messagesCursor);
    params.set('limit', limit.toString());

    return fetchApi(`${API_BASE}/conversations/${id}?${params}`);
  },

  async deleteConversation(id: string): Promise<void> {
    return fetchApi(`${API_BASE}/conversations/${id}`, {
      method: 'DELETE',
    });
  },

  async sendMessage(
    conversationId: string,
    content: string,
    signal?: AbortSignal
  ): Promise<SendMessageResponse> {
    return fetchApi(`${API_BASE}/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
      signal,
    });
  },
};

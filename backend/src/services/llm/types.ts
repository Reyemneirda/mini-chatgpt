export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmAdapter {
  complete(input: { messages: Message[] }): Promise<{ completion: string }>;
}

export interface LlmConfig {
  provider: 'mock' | 'ollama';
  mockBaseUrl?: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

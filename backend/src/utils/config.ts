import { LlmConfig } from '../services/llm';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || '',

  llm: {
    provider: (process.env.LLM_PROVIDER || 'mock') as 'mock' | 'ollama',
    mockBaseUrl: process.env.MOCK_LLM_BASE_URL || 'http://mock-llm:8080',
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://ollama:11434',
    ollamaModel: process.env.OLLAMA_MODEL || 'llama3',
    timeout: parseInt(process.env.LLM_TIMEOUT_MS || '12000', 10),
    maxRetries: parseInt(process.env.LLM_MAX_RETRIES || '2', 10),
    retryDelayMs: parseInt(process.env.LLM_RETRY_DELAY_MS || '1000', 10),
  } as LlmConfig,
};

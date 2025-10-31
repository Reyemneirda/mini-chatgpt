import { LlmAdapter, LlmConfig } from './types';
import { MockLlmAdapter } from './mockAdapter';
import { OllamaLlmAdapter } from './ollamaAdapter';
import { logger } from '../../utils/logger';

export function createLlmAdapter(config: LlmConfig): LlmAdapter {
  logger.info(`Creating LLM adapter for provider: ${config.provider}`);

  switch (config.provider) {
    case 'mock':
      if (!config.mockBaseUrl) {
        throw new Error('MOCK_LLM_BASE_URL is required for mock provider');
      }
      return new MockLlmAdapter({
        baseUrl: config.mockBaseUrl,
        timeout: config.timeout,
        maxRetries: config.maxRetries,
        retryDelayMs: config.retryDelayMs,
      });

    case 'ollama':
      if (!config.ollamaBaseUrl || !config.ollamaModel) {
        throw new Error('OLLAMA_BASE_URL and OLLAMA_MODEL are required for ollama provider');
      }
      return new OllamaLlmAdapter({
        baseUrl: config.ollamaBaseUrl,
        model: config.ollamaModel,
        timeout: config.timeout,
        maxRetries: config.maxRetries,
        retryDelayMs: config.retryDelayMs,
      });

    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

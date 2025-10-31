import { LlmAdapter, Message } from "./types";
import { logger } from "../../utils/logger";

export class OllamaLlmAdapter implements LlmAdapter {
  private baseUrl: string;
  private model: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(config: {
    baseUrl: string;
    model: string;
    timeout?: number;
    maxRetries?: number;
    retryDelayMs?: number;
  }) {
    this.baseUrl = config.baseUrl;
    this.model = config.model;
    this.timeout = config.timeout || 12000;
    this.maxRetries = config.maxRetries || 2;
    this.retryDelayMs = config.retryDelayMs || 1000;
  }

  async complete(input: {
    messages: Message[];
  }): Promise<{ completion: string }> {
    return this.fetchWithRetry(input.messages);
  }

  private async fetchWithRetry(
    messages: Message[],
    attempt: number = 0
  ): Promise<{ completion: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      logger.info(
        `Calling Ollama LLM (attempt ${attempt + 1}/${this.maxRetries + 1})`
      );

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          prompt: messages.map((m) => `${m.role}: ${m.content}`).join("\n"),
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}`);
      }

      const data = (await response.json()) as {
        response?: string;
        completion?: string;
      };
      const completion: string | undefined = data.response || data.completion;
      if (!completion) {
        throw new Error("Ollama response missing completion field");
      }
      return { completion };
    } catch (error: any) {
      clearTimeout(timeoutId);

      const isTimeout = error.name === "AbortError";
      const is500Error = error.message?.includes("500");

      if ((isTimeout || is500Error) && attempt < this.maxRetries) {
        const delay = this.retryDelayMs * Math.pow(2, attempt);
        logger.warn(
          `Ollama call failed (${
            isTimeout ? "timeout" : "500 error"
          }), retrying in ${delay}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(messages, attempt + 1);
      }

      logger.error("Ollama call failed after all retries", {
        error: error.message,
      });
      throw error;
    }
  }
}

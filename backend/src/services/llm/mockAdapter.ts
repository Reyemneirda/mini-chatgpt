import { LlmAdapter, Message } from "./types";
import { logger } from "../../utils/logger";

export class MockLlmAdapter implements LlmAdapter {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(config: {
    baseUrl: string;
    timeout?: number;
    maxRetries?: number;
    retryDelayMs?: number;
  }) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout || 12000;
    this.maxRetries = config.maxRetries || 2;
    this.retryDelayMs = config.retryDelayMs || 1000;
  }

  async complete(input: {
    messages: Message[];
  }): Promise<{ completion: string }> {
    const content = input.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    return this.fetchWithRetry(content);
  }

  private async fetchWithRetry(
    content: string,
    attempt: number = 0
  ): Promise<{ completion: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      logger.info(
        `Calling mock LLM (attempt ${attempt + 1}/${this.maxRetries + 1})`
      );

      const response = await fetch(`${this.baseUrl}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Mock LLM returned ${response.status}`);
      }

      const data = (await response.json()) as { completion: string };
      return { completion: data.completion };
    } catch (error: any) {
      clearTimeout(timeoutId);

      const isTimeout = error.name === "AbortError";
      const is500Error = error.message?.includes("500");

      if ((isTimeout || is500Error) && attempt < this.maxRetries) {
        const delay = this.retryDelayMs * Math.pow(2, attempt);
        logger.warn(
          `LLM call failed (${
            isTimeout ? "timeout" : "500 error"
          }), retrying in ${delay}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.fetchWithRetry(content, attempt + 1);
      }

      logger.error("LLM call failed after all retries", {
        error: error.message,
      });
      throw error;
    }
  }
}

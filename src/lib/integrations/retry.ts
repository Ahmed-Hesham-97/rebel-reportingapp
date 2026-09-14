import "server-only";

import { logger } from "@/lib/logger";

export async function withRetry<T>(operation: () => Promise<T>, context: { source: string; attempts?: number }) {
  const attempts = context.attempts ?? 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const retryable = error instanceof IntegrationError && (error.status === 429 || error.status >= 500);
      if (!retryable && !(error instanceof TypeError)) break;
      const delay = Math.min(8000, 400 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 250);
      logger.warn({ source: context.source, attempt, delay }, "retrying integration request");
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Integration request failed");
}

export class IntegrationError extends Error {
  constructor(message: string, public readonly status: number, public readonly responseSize?: number) {
    super(message);
    this.name = "IntegrationError";
  }
}

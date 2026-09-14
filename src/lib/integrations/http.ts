import "server-only";

import { logger } from "@/lib/logger";
import { IntegrationError, withRetry } from "@/lib/integrations/retry";

export async function requestJson<T>(source: string, url: string, init: RequestInit = {}) {
  return withRetry(async () => {
    const started = performance.now();
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(30_000),
      headers: { Accept: "application/json", ...init.headers },
      cache: "no-store",
    });
    const text = await response.text();
    logger.info({ source, endpoint: new URL(url).pathname, status: response.status, durationMs: Math.round(performance.now() - started), responseSize: text.length }, "integration request");
    if (!response.ok) throw new IntegrationError(`${source} request failed`, response.status, text.length);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new IntegrationError(`${source} returned invalid JSON`, response.status, text.length);
    }
  }, { source });
}

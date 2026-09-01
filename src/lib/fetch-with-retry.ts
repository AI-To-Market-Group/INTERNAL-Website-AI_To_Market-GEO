/**
 * Fetch wrapper with retries on 5xx or network errors.
 * Exponential backoff: 1 retry after ~1s, 2nd retry after ~2s.
 */

const DEFAULT_MAX_RETRIES = 2;
const INITIAL_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { maxRetries?: number }
): Promise<Response> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.ok || res.status < 500) {
        return res;
      }
      const body = await res.text().catch(() => "");
      lastError = new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
      if (attempt < maxRetries) {
        const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempt);
        await delay(delayMs);
      }
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delayMs = INITIAL_DELAY_MS * Math.pow(2, attempt);
        await delay(delayMs);
      } else {
        throw err;
      }
    }
  }

  throw lastError;
}

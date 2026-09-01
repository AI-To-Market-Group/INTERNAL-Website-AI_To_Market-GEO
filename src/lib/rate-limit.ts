/**
 * Rate limiter — in-memory only (DB disabled).
 * Note: per-instance, not global across serverless invocations.
 */

// import { getPool } from "@/lib/db/client";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

// In-memory fallback (used when POSTGRES_URL is not set)
const memoryWindows = new Map<string, { count: number; resetAt: number }>();

function checkRateLimitMemory(
  identifier: string,
  route: string,
  limit: number
): { ok: boolean; remaining: number } {
  const key = `${route}:${identifier}`;
  const now = Date.now();
  const entry = memoryWindows.get(key);

  if (!entry) {
    memoryWindows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: limit - 1 };
  }

  if (now >= entry.resetAt) {
    memoryWindows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0 };
  }

  entry.count++;
  return { ok: true, remaining: limit - entry.count };
}

export async function checkRateLimit(
  identifier: string,
  route: string,
  limit: number
): Promise<{ ok: boolean; remaining: number }> {
  // DB disabled — always use in-memory rate limiting
  return checkRateLimitMemory(identifier, route, limit);
}

export const RATE_LIMITS = {
  "geo/run": 20,
  "insights/generate": 50,
  "identity/analyze": 30,
} as const;

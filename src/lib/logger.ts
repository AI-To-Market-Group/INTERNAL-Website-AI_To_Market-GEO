/**
 * Centralized error logging for API routes.
 * Logs structured payload for monitoring. Optional: send to external service.
 */

export function logError(
  route: string,
  error: unknown,
  context?: Record<string, unknown>
) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const payload = {
    route,
    message,
    stack,
    ...context,
  };
  console.error("[API Error]", JSON.stringify(payload));
}

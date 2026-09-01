import { NextResponse } from "next/server";
import type { z } from "zod";

/**
 * Standardized API response helpers for consistent JSON shapes and status codes.
 */

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(
  message: string,
  status = 500,
  code?: string
): NextResponse {
  const body: { error: string; code?: string } = { error: message };
  if (code) body.code = code;
  return NextResponse.json(body, { status });
}

export type ParseResult<T> =
  | { data: T; error: null }
  | { data: null; error: NextResponse };

/**
 * Parse request body as JSON and validate with a Zod schema.
 * Returns { data, error: null } on success, or { data: null, error: NextResponse } on failure.
 */
export async function parseBody<T extends z.ZodType>(
  req: Request,
  schema: T
): Promise<ParseResult<z.infer<T>>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { data: null, error: err("Invalid JSON body", 400, "INVALID_JSON") };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    const issues = result.error.flatten();
    const message =
      issues.formErrors?.[0] ??
      Object.values(issues.fieldErrors).flat().join(", ") ??
      "Validation failed";
    return {
      data: null,
      error: err(message, 400, "VALIDATION_ERROR"),
    };
  }
  return { data: result.data as z.infer<T>, error: null };
}

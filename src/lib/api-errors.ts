import { NextResponse } from "next/server";

/**
 * Typed API errors with consistent toResponse() for JSON responses.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 500,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }

  toResponse(): NextResponse {
    const body: { error: string; code?: string } = { error: this.message };
    if (this.code) body.code = this.code;
    return NextResponse.json(body, { status: this.status });
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export class NotFoundError extends ApiError {
  constructor(message = "Not found") {
    super(message, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class AuthError extends ApiError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "AuthError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

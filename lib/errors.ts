// Centralised API error helpers — keeps response shape consistent and adds
// a traceable X-Request-Id header without leaking stack traces in production.

function makeId() {
  return crypto.randomUUID();
}

function errorResponse(detail: string, status: number, extra?: Record<string, string>) {
  return Response.json(
    { detail },
    {
      status,
      headers: { "X-Request-Id": makeId(), ...extra },
    }
  );
}

export function unauthorized(detail = "Authentication required") {
  return errorResponse(detail, 401);
}

export function forbidden(detail = "Access denied") {
  return errorResponse(detail, 403);
}

export function tooManyRequests(detail = "Too many requests. Please try again later.", retryAfter?: number) {
  return errorResponse(detail, 429, retryAfter ? { "Retry-After": String(retryAfter) } : undefined);
}

export function badRequest(detail: string) {
  return errorResponse(detail, 400);
}

export interface ValidationIssue {
  path: string;
  code: string;
}

export function validationError(issues: ValidationIssue[]) {
  return Response.json(
    { detail: "Validation failed", code: "validation_error", errors: issues },
    { status: 400, headers: { "X-Request-Id": makeId() } }
  );
}

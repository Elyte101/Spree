import { NextRequest } from "next/server";

import { badRequest, tooManyRequests } from "@/lib/errors";
import { checkRateLimit, recordFailedAttempt } from "@/lib/rateLimit";
import { parseOrBadRequest, SignUpSchema } from "@/lib/validation";
import { proxyBackend } from "@/lib/serverApi";

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  // Rate-limit check runs before ANY downstream work so backend errors
  // count toward the budget: 5 failures (of any kind) → lockout.
  const rl = checkRateLimit(`signup:${ip}`);
  if (!rl.allowed) {
    return tooManyRequests("Too many signup attempts. Please try again later.", rl.retryAfter);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    recordFailedAttempt(`signup:${ip}`);
    return badRequest("Request body must be valid JSON");
  }

  const parsed = parseOrBadRequest(SignUpSchema, raw);
  if (!parsed.ok) {
    recordFailedAttempt(`signup:${ip}`);
    return parsed.response;
  }

  const response = await proxyBackend(
    "/auth/signup",
    {
      method: "POST",
      body: JSON.stringify(parsed.data),
      headers: { "Content-Type": "application/json" },
    },
    { internal: true },
  );

  if (!response.ok) {
    recordFailedAttempt(`signup:${ip}`);
  }

  return response;
}

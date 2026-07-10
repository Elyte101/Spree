import { NextRequest } from "next/server";

import { badRequest, tooManyRequests } from "@/lib/errors";
import { sendVerificationEmail } from "@/lib/email";
import { checkRateLimit, recordFailedAttempt } from "@/lib/rateLimit";
import { getBackendApiBaseUrl, getBackendInternalApiKey } from "@/lib/runtimeConfig";
import { parseOrBadRequest, SignUpSchema } from "@/lib/validation";
import { proxyBackend } from "@/lib/serverApi";

// STEP 1 (2026-07-10 email flow assessment): trigger the EXISTING
// verification pipeline (backend create_verification_token via
// /auth/send-verification, then the frontend's sendVerificationEmail) right
// after account creation. Triggered here rather than from the backend
// because the user isn't signed in yet at signup time — the only existing
// consumer of this pipeline (app/api/auth/send-verification/route.ts)
// requires a session, which doesn't exist until after this request. Kept
// entirely non-fatal: any failure here is logged and swallowed, never
// turning a successful 201 signup into an error response.
async function sendSignupVerificationEmail(email: string): Promise<void> {
  try {
    const tokenRes = await fetch(`${getBackendApiBaseUrl()}/auth/send-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": getBackendInternalApiKey(),
      },
      body: JSON.stringify({ email }),
      // Tight budget — this is just a DB insert (create_verification_token),
      // and it's chained before the Resend send below within the same
      // signup request; see RESEND_TIMEOUT_MS in lib/email.ts for why both
      // are kept short.
      signal: AbortSignal.timeout(3000),
    });
    if (!tokenRes.ok) {
      console.warn("[signup] failed to generate verification token", { status: tokenRes.status });
      return;
    }
    const { token } = await tokenRes.json();
    await sendVerificationEmail(email, token);
  } catch (err) {
    console.warn(
      "[signup] verification email send failed (non-fatal)",
      err instanceof Error ? err.message : err
    );
  }
}

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
    return response;
  }

  // Fire-and-forget from the response's perspective, but still awaited so
  // this serverless function doesn't exit before the send attempt finishes
  // (Vercel functions stop running once the response is returned).
  await sendSignupVerificationEmail(parsed.data.email);

  return response;
}

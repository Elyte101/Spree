import { NextRequest } from "next/server";

import { badRequest } from "@/lib/errors";
import { parseOrBadRequest, PasswordResetRequestSchema } from "@/lib/validation";
import { proxyBackend } from "@/lib/serverApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }

  const parsed = parseOrBadRequest(PasswordResetRequestSchema, raw);
  if (!parsed.ok) {
    return parsed.response;
  }

  // A6: the backend enforces its own per-email rate limit and always
  // returns a generic 200 regardless of whether the email has an account,
  // so there's nothing account-existence-revealing to guard here.
  return proxyBackend(
    "/auth/password-reset/request",
    {
      method: "POST",
      body: JSON.stringify(parsed.data),
      headers: { "Content-Type": "application/json" },
    },
    { internal: true }
  );
}

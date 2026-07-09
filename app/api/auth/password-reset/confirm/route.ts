import { NextRequest } from "next/server";

import { badRequest } from "@/lib/errors";
import { parseOrBadRequest, PasswordResetConfirmSchema } from "@/lib/validation";
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

  const parsed = parseOrBadRequest(PasswordResetConfirmSchema, raw);
  if (!parsed.ok) {
    return parsed.response;
  }

  return proxyBackend(
    "/auth/password-reset/confirm",
    {
      method: "POST",
      body: JSON.stringify(parsed.data),
      headers: { "Content-Type": "application/json" },
    },
    { internal: true }
  );
}

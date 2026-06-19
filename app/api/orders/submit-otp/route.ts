
import { auth } from "@/auth";
import { badRequest, unauthorized } from "@/lib/errors";
import { SubmitOtpSchema, parseOrBadRequest } from "@/lib/validation";
import { proxyBackend } from "@/lib/serverApi";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return unauthorized();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }

  const parsed = parseOrBadRequest(SubmitOtpSchema, raw);
  if (!parsed.ok) return parsed.response;

  return proxyBackend(
    "/orders/submit-otp",
    {
      method: "POST",
      body: JSON.stringify(parsed.data),
      headers: { "Content-Type": "application/json" },
    },
    { internal: true }
  );
}

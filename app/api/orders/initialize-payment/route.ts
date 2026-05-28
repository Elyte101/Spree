
import { auth } from "@/auth";
import { badRequest, unauthorized } from "@/lib/errors";
import { CreateOrderSchema, parseOrBadRequest } from "@/lib/validation";
import { proxyBackend } from "@/lib/serverApi";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return unauthorized();
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON");
  }

  const parsed = parseOrBadRequest(CreateOrderSchema, raw);
  if (!parsed.ok) return parsed.response;

  const callbackUrl = new URL("/checkout/verify", request.url).toString();

  const backendUrl = `/orders/initialize-payment?callback_url=${encodeURIComponent(callbackUrl)}`;
  return proxyBackend(
    backendUrl,
    {
      method: "POST",
      body: JSON.stringify({ ...parsed.data, userId: session.user.id }),
      headers: { "Content-Type": "application/json" },
    },
    { internal: true }
  );
}

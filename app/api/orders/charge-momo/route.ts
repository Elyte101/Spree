
import { auth } from "@/auth";
import { badRequest, unauthorized } from "@/lib/errors";
import { ChargeMomoSchema, parseOrBadRequest } from "@/lib/validation";
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

  const parsed = parseOrBadRequest(ChargeMomoSchema, raw);
  if (!parsed.ok) return parsed.response;

  return proxyBackend(
    "/orders/charge-momo",
    {
      method: "POST",
      body: JSON.stringify({ ...parsed.data, userId: session.user.id }),
      headers: { "Content-Type": "application/json" },
    },
    { internal: true }
  );
}

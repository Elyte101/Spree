
import { auth } from "@/auth";
import { unauthorized } from "@/lib/errors";
import { proxyBackend } from "@/lib/serverApi";

export async function GET() {
  const session = await auth();
  if (!session) {
    return unauthorized();
  }
  return proxyBackend("/orders", {
    headers: {
      "X-Actor-User-Id": session.user.id,
      "X-Actor-Role": session.user.role,
    },
  }, { internal: true });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return unauthorized();
  }
  const body = await request.json();

  return proxyBackend(
    "/orders",
    {
      method: "POST",
      body: JSON.stringify({ ...body, userId: session.user.id }),
      headers: { "Content-Type": "application/json" },
    },
    { internal: true }
  );
}

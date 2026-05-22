import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ detail: "Authentication required" }, { status: 401 });
  }
  return proxyBackend("/orders", {
    headers: {
      "X-Actor-User-Id": session.user.id,
      "X-Actor-Role": session.user.role,
    },
  }, { internal: true });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const body = await request.json();

  return proxyBackend(
    "/orders",
    {
      method: "POST",
      body: JSON.stringify({ ...body, userId: session?.user?.id ?? null }),
      headers: { "Content-Type": "application/json" },
    },
    { internal: true }
  );
}

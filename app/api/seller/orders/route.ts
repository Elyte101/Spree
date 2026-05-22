import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ detail: "Authentication required" }, { status: 401 });
  }
  return proxyBackend("/seller/orders", {
    headers: { "X-Actor-User-Id": session.user.id },
  }, { internal: true });
}

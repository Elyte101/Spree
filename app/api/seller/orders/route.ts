
import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET() {
  const session = await auth();
  if (!session) {
    return Response.json({ detail: "Authentication required" }, { status: 401 });
  }
  return proxyBackend("/vendor/orders", {
    headers: { "X-Actor-User-Id": session.user.id },
  }, { internal: true });
}

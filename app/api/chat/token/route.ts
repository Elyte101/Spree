import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ detail: "Authentication required" }, { status: 401 });
  }
  return proxyBackend("/chat/token", {
    headers: {
      "X-Actor-User-Id": session.user.id,
      "X-Actor-Role": session.user.role ?? "customer",
    },
  }, { internal: true });
}

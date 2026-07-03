import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return Response.json({ detail: "Admin access required" }, { status: 403 });
  }
  return proxyBackend("/chat/admin-token", {
    method: "POST",
    headers: {
      "X-Actor-User-Id": session.user.id,
      "X-Actor-Role": "admin",
    },
  }, { internal: true });
}

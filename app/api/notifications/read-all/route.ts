import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return proxyBackend("/notifications/read-all", {
    method: "POST",
    headers: { "X-Actor-User-Id": session.user.id },
  }, { internal: true });
}

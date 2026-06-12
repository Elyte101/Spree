import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ count: 0 });
  }
  return proxyBackend("/notifications/unread-count", {
    headers: { "X-Actor-User-Id": session.user.id },
  }, { internal: true });
}

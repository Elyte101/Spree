import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ detail: "Authentication required" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return Response.json({ detail: "Forbidden" }, { status: 403 });
  }
  const { search } = new URL(request.url);
  return proxyBackend(`/sellers${search}`, {
    headers: { "X-Actor-Role": "admin", "X-Actor-User-Id": session.user.id },
  }, { internal: true });
}

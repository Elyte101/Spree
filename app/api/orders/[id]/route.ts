
import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return Response.json({ detail: "Authentication required" }, { status: 401 });
  }
  const { id } = await params;
  return proxyBackend(`/orders/${id}`, {
    headers: {
      "X-Actor-User-Id": session.user.id,
      "X-Actor-Role": session.user.role,
    },
  }, { internal: true });
}

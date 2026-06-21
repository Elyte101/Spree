import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  return proxyBackend(`/admin/sellers/${id}/approve`, {
    method: "POST",
    headers: {
      "X-Actor-Role": "admin",
      "X-Actor-User-Id": session.user.id,
    },
  }, { internal: true });
}

import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  return proxyBackend(`/notifications/${id}/read`, {
    method: "PATCH",
    headers: { "X-Actor-User-Id": session.user.id },
  }, { internal: true });
}

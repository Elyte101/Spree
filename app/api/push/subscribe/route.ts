import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.text();
  return proxyBackend("/push/subscribe", {
    method: "POST",
    headers: { "X-Actor-User-Id": session.user.id },
    body,
  }, { internal: true });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.text();
  return proxyBackend("/push/subscribe", {
    method: "DELETE",
    headers: { "X-Actor-User-Id": session.user.id },
    body,
  }, { internal: true });
}

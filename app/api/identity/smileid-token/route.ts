import "server-only";
import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  return proxyBackend("/identity/smileid-token", {
    method: "GET",
    headers: { "X-Actor-User-Id": session.user.id },
  }, { internal: true });
}

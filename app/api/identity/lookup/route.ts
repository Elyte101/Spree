import "server-only";
import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.idNumber) return Response.json({ error: "idNumber is required" }, { status: 400 });

  return proxyBackend("/identity/lookup", {
    method: "POST",
    headers: { "X-Actor-User-Id": session.user.id },
    body: JSON.stringify(body),
  }, { internal: true });
}

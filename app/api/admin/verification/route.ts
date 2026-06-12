import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return proxyBackend("/admin/verification", {
    headers: { "X-Actor-Role": "admin" },
  }, { internal: true });
}

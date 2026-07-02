import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET() {
  const session = await auth();
  return proxyBackend(
    "/notifications",
    { headers: session?.user?.id ? { "X-Actor-User-Id": session.user.id } : {} },
    { internal: true },
  );
}

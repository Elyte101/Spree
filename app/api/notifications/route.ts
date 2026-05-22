import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET() {
  const session = await getServerSession(authOptions);
  return proxyBackend("/notifications", {
    headers: session?.user?.id ? { "X-Actor-User-Id": session.user.id } : {},
  });
}

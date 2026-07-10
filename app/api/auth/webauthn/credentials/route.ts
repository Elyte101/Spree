import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  }
  return proxyBackend(
    "/auth/webauthn/credentials",
    { headers: { "X-Actor-User-Id": session.user.id } },
    { internal: true }
  );
}

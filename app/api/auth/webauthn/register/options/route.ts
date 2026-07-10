import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function POST() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  }
  return proxyBackend(
    "/auth/webauthn/register/options",
    {
      method: "POST",
      headers: { "X-Actor-User-Id": session.user.id },
    },
    { internal: true }
  );
}

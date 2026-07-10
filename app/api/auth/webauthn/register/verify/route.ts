import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  }
  const body = await request.text();
  return proxyBackend(
    "/auth/webauthn/register/verify",
    {
      method: "POST",
      body,
      headers: {
        "Content-Type": "application/json",
        "X-Actor-User-Id": session.user.id,
      },
    },
    { internal: true }
  );
}

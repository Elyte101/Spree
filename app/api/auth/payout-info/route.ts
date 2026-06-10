import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function PUT(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  }
  const body = await request.json();
  return proxyBackend(
    `/auth/profile/${session.user.id}/payout-info`,
    {
      method: "PUT",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "X-Actor-User-Id": session.user.id,
      },
    },
    { internal: true }
  );
}

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  }
  const body = await request.json();
  return proxyBackend(
    `/auth/profile/${session.user.id}/payout-info`,
    { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } },
    { internal: true }
  );
}

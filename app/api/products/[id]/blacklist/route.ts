import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "admin") {
    return NextResponse.json({ detail: "Admin only" }, { status: 403 });
  }

  const { id } = await params;
  return proxyBackend(
    `/products/${id}/blacklist`,
    {
      method: "PATCH",
      body: await request.text(),
      headers: { "Content-Type": "application/json", "X-Actor-Role": "admin", "X-Actor-User-Id": session.user.id },
    },
    { internal: true }
  );
}

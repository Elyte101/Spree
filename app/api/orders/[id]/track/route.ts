import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json();
  return proxyBackend(
    `/orders/${id}/track`,
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

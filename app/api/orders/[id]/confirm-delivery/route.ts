import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  }
  const { id } = await params;
  return proxyBackend(
    `/orders/${id}/confirm-delivery`,
    {
      method: "PUT",
      headers: { "X-Actor-User-Id": session.user.id },
    },
    { internal: true }
  );
}

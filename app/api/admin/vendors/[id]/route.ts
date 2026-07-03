import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { detail: "You must be signed in to view vendor details" },
      { status: 401 }
    );
  }

  if (session.user.role !== "admin") {
    return NextResponse.json(
      { detail: "Only admins can view vendor details" },
      { status: 403 }
    );
  }

  const { id } = await params;
  return proxyBackend(`/admin/sellers/${id}`, {
    headers: { "X-Actor-Role": "admin", "X-Actor-User-Id": session.user.id },
  }, { internal: true });
}

export async function DELETE(
  _request: Request,
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
    `/admin/sellers/${id}`,
    { method: "DELETE", headers: { "X-Actor-Role": "admin", "X-Actor-User-Id": session.user.id } },
    { internal: true }
  );
}

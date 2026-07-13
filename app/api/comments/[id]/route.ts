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

  const { id } = await params;

  return proxyBackend(
    `/comments/${id}`,
    {
      method: "PATCH",
      body: await request.text(),
      headers: {
        "Content-Type": "application/json",
        "X-Actor-Role": session.user.role,
        "X-Actor-User-Id": session.user.id,
      },
    },
    { internal: true }
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  return proxyBackend(
    `/comments/${id}`,
    {
      method: "DELETE",
      headers: {
        "X-Actor-Role": session.user.role,
        "X-Actor-User-Id": session.user.id,
      },
    },
    { internal: true }
  );
}

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackend(`/products/${id}`);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  return proxyBackend(
    `/products/${id}`,
    {
      method: "PUT",
      body: await request.text(),
      headers: {
        "Content-Type": "application/json",
        "X-Actor-User-Id": session.user.id,
        "X-Actor-Role": session.user.role,
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
    `/products/${id}`,
    {
      method: "DELETE",
      headers: {
        "X-Actor-User-Id": session.user.id,
        "X-Actor-Role": session.user.role,
      },
    },
    { internal: true }
  );
}

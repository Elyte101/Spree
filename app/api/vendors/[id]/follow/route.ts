import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { detail: "You must be signed in to follow sellers" },
      { status: 401 }
    );
  }

  const { id } = await params;

  return proxyBackend(
    `/sellers/${id}/follow`,
    {
      method: "POST",
      body: JSON.stringify({ followerId: session.user.id }),
      headers: { "Content-Type": "application/json" },
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
    return NextResponse.json(
      { detail: "You must be signed in to unfollow sellers" },
      { status: 401 }
    );
  }

  const { id } = await params;

  return proxyBackend(
    `/sellers/${id}/follow`,
    {
      method: "DELETE",
      body: JSON.stringify({ followerId: session.user.id }),
      headers: { "Content-Type": "application/json" },
    },
    { internal: true }
  );
}

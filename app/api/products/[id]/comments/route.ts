import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return proxyBackend(`/products/${id}/comments`);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { detail: "You must be signed in to leave a review" },
      { status: 401 }
    );
  }

  const { id } = await params;

  return proxyBackend(
    `/products/${id}/comments`,
    {
      method: "POST",
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

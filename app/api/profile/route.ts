import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { detail: "You must be signed in to view your profile" },
      { status: 401 }
    );
  }

  return proxyBackend(
    `/auth/profile/${session.user.id}`,
    {
      headers: {
        "X-Actor-User-Id": session.user.id,
        "X-Actor-Role": session.user.role,
      },
    },
    { internal: true }
  );
}

export async function PUT(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { detail: "You must be signed in to update your profile" },
      { status: 401 }
    );
  }

  return proxyBackend(
    `/auth/profile/${session.user.id}`,
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

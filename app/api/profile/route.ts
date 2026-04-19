import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { detail: "You must be signed in to view your profile" },
      { status: 401 }
    );
  }

  return proxyBackend(`/auth/profile/${session.user.id}`, undefined, { internal: true });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

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
      },
    },
    { internal: true }
  );
}

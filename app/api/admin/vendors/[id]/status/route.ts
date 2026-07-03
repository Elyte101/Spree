import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { detail: "You must be signed in to manage vendor status" },
      { status: 401 }
    );
  }

  if (session.user.role !== "admin") {
    return NextResponse.json(
      { detail: "Only admins can manage vendor status" },
      { status: 403 }
    );
  }

  const { id } = await params;

  return proxyBackend(
    `/admin/sellers/${id}/status`,
    {
      method: "PUT",
      body: await request.text(),
      headers: {
        "Content-Type": "application/json",
        "X-Actor-Role": "admin",
        "X-Actor-User-Id": session.user.id,
      },
    },
    { internal: true }
  );
}

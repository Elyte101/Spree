import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  }
  const { id } = await params;
  return proxyBackend(
    `/auth/webauthn/credentials/${id}`,
    {
      method: "DELETE",
      headers: { "X-Actor-User-Id": session.user.id },
    },
    { internal: true }
  );
}

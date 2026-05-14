import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { detail: "You must be signed in to report sellers" },
      { status: 401 }
    );
  }

  const payload = (await request.json()) as { reason?: string; details?: string };
  const { id } = await params;

  return proxyBackend(
    `/sellers/${id}/report`,
    {
      method: "POST",
      body: JSON.stringify({
        reporterId: session.user.id,
        reason: payload.reason,
        details: payload.details ?? "",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    },
    { internal: true }
  );
}

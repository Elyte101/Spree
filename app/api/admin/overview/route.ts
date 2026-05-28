import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { detail: "You must be signed in to view admin overview" },
      { status: 401 }
    );
  }

  if (session.user.role !== "admin") {
    return NextResponse.json(
      { detail: "Only admins can view admin overview" },
      { status: 403 }
    );
  }

  return proxyBackend("/admin/overview", undefined, { internal: true });
}

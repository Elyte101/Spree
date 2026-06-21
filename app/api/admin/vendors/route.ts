import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { detail: "You must be signed in to view seller management" },
      { status: 401 }
    );
  }

  if (session.user.role !== "admin") {
    return NextResponse.json(
      { detail: "Only admins can view seller management" },
      { status: 403 }
    );
  }

  return proxyBackend("/admin/sellers", undefined, { internal: true });
}

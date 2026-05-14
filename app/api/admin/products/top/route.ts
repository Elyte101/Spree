import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { detail: "You must be signed in to view top products" },
      { status: 401 }
    );
  }

  if (session.user.role !== "admin") {
    return NextResponse.json(
      { detail: "Only admins can view top products" },
      { status: 403 }
    );
  }

  const { search } = new URL(request.url);
  return proxyBackend(`/admin/products/top${search}`, undefined, { internal: true });
}

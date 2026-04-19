import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { canCreateProductsRole } from "@/lib/roles";
import { proxyBackend } from "@/lib/serverApi";

export async function GET(request: Request) {
  const { search } = new URL(request.url);
  return proxyBackend(`/products${search}`);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json(
      { detail: "You must be signed in to create products" },
      { status: 401 }
    );
  }

  if (!canCreateProductsRole(session.user.role)) {
    return NextResponse.json(
      { detail: "Only sellers and admins can create products" },
      { status: 403 }
    );
  }

  return proxyBackend(
    "/products",
    {
      method: "POST",
      body: await request.text(),
      headers: {
        "Content-Type": "application/json",
      },
    },
    { internal: true }
  );
}

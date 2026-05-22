import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { proxyBackend } from "@/lib/serverApi";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const body = await request.json();

  const callbackUrl = new URL("/checkout/verify", request.url).toString();

  const backendUrl = `/orders/initialize-payment?callback_url=${encodeURIComponent(callbackUrl)}`;
  return proxyBackend(
    backendUrl,
    {
      method: "POST",
      body: JSON.stringify({ ...body, userId: session?.user?.id ?? null }),
      headers: { "Content-Type": "application/json" },
    },
    { internal: true }
  );
}

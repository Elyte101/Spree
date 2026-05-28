import { NextRequest, NextResponse } from "next/server";

import { getBackendApiBaseUrl, getBackendInternalApiKey } from "@/lib/runtimeConfig";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let token: string;
  try {
    const body = await request.json();
    token = typeof body?.token === "string" ? body.token.trim() : "";
  } catch {
    return NextResponse.json({ detail: "Invalid request body" }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ detail: "Token is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${getBackendApiBaseUrl()}/auth/verify-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": getBackendInternalApiKey(),
      },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { detail: (data as { detail?: string }).detail ?? "Invalid or expired link" },
        { status: 400 }
      );
    }

    return NextResponse.json({ detail: "Email verified successfully" });
  } catch {
    return NextResponse.json({ detail: "Verification failed" }, { status: 500 });
  }
}

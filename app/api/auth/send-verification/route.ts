import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { sendVerificationEmail } from "@/lib/email";
import { getBackendApiBaseUrl, getBackendInternalApiKey } from "@/lib/runtimeConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  if (session.user.emailVerified) {
    return NextResponse.json({ detail: "Email is already verified" }, { status: 400 });
  }

  try {
    const res = await fetch(`${getBackendApiBaseUrl()}/auth/send-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Api-Key": getBackendInternalApiKey(),
      },
      body: JSON.stringify({ email: session.user.email }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ detail: "Failed to generate verification token" }, { status: 500 });
    }

    const { token } = await res.json();
    await sendVerificationEmail(session.user.email, token);

    return NextResponse.json({ detail: "Verification email sent" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to send verification email";
    const isConfig = msg.includes("RESEND_API_KEY");
    return NextResponse.json({ detail: isConfig ? "Email service not configured" : msg }, { status: 500 });
  }
}

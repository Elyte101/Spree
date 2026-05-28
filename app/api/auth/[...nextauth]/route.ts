import { NextRequest, NextResponse } from "next/server";

import { handlers } from "@/auth";
import { checkRateLimit, recordFailedAttempt } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET } = handlers;

export async function POST(request: NextRequest) {
  if (request.nextUrl.pathname.endsWith("/callback/credentials")) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const ipKey = `login-ip:${ip}`;

    let email = "";
    try {
      const form = await request.clone().formData();
      email = form.get("email")?.toString().trim() ?? "";
    } catch {
      /* unparseable body — skip email check */
    }

    const ipRl = checkRateLimit(ipKey);
    if (!ipRl.allowed) {
      return NextResponse.json(
        { detail: "Too many login attempts. Please try again later.", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(ipRl.retryAfter ?? 900) } }
      );
    }

    if (email) {
      const emailRl = checkRateLimit(email);
      if (!emailRl.allowed) {
        return NextResponse.json(
          { detail: "Too many login attempts. Please try again later.", code: "rate_limited" },
          { status: 429, headers: { "Retry-After": String(emailRl.retryAfter ?? 900) } }
        );
      }
    }

    recordFailedAttempt(ipKey);
    if (email) recordFailedAttempt(email);
  }

  return handlers.POST(request);
}

import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { checkRateLimit, recordFailedAttempt } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const nextAuthHandler = NextAuth(authOptions);
type NextAuthContext = Parameters<typeof nextAuthHandler>[1];

type Context = { params: Promise<{ nextauth: string[] }> };

function isCredentialsCallback(req: NextRequest): boolean {
  return req.nextUrl.pathname.endsWith("/callback/credentials");
}

async function checkLoginLimiter(
  req: NextRequest
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const ipKey = `login-ip:${ip}`;
  const ipRl = checkRateLimit(ipKey);
  if (!ipRl.allowed) return { ok: false, retryAfter: ipRl.retryAfter ?? 900 };

  let email = "";
  try {
    const form = await req.clone().formData();
    email = form.get("email")?.toString().trim() ?? "";
  } catch {
    // Unparseable body — proceed without email check
  }

  if (email) {
    const emailRl = checkRateLimit(email);
    if (!emailRl.allowed) return { ok: false, retryAfter: emailRl.retryAfter ?? 900 };
  }

  // Pessimistic: count this attempt before delegating to NextAuth.
  // On success, the signIn event in lib/auth.ts clears the email counter.
  recordFailedAttempt(ipKey);
  if (email) recordFailedAttempt(email);

  return { ok: true };
}

export const GET = nextAuthHandler;

export async function POST(request: NextRequest, context: Context) {
  if (isCredentialsCallback(request)) {
    const decision = await checkLoginLimiter(request);
    if (!decision.ok) {
      return NextResponse.json(
        { detail: "Too many attempts", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(decision.retryAfter) } }
      );
    }
  }
  return nextAuthHandler(request, context as unknown as NextAuthContext);
}

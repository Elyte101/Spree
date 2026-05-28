import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock NextAuth so we don't need a real NEXTAUTH_SECRET / DB
vi.mock("next-auth", () => ({
  default: () => async () => new Response("{}", { status: 200 }),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/runtimeConfig", () => ({
  getNextAuthSecret: () => "test-secret",
  getBackendApiBaseUrl: () => "http://localhost:8000",
}));

import { POST } from "./route";
import {
  clearFailedAttempts,
  recordFailedAttempt,
} from "@/lib/rateLimit";
import { NextRequest } from "next/server";

const IP = "10.0.0.1";
const EMAIL = "victim@example.com";

const ctx = { params: Promise.resolve({ nextauth: ["callback", "credentials"] }) };

function credReq(email = EMAIL, ip = IP) {
  const body = new URLSearchParams({
    email,
    password: "wrong",
    csrfToken: "mock-token",
  });
  return new NextRequest("http://localhost:3000/api/auth/callback/credentials", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-forwarded-for": ip,
    },
    body: body.toString(),
  });
}

beforeEach(() => {
  clearFailedAttempts(EMAIL);
  clearFailedAttempts(`login-ip:${IP}`);
});

describe("login rate limiter — NextAuth wrapper", () => {
  it("passes through to NextAuth when email is not rate-limited", async () => {
    const res = await POST(credReq(), ctx);
    // Mocked NextAuth returns 200
    expect(res.status).toBe(200);
  });

  it("returns 429 when the email is already locked out", async () => {
    // Pre-seed 5 failures — as authorize() would do on wrong password
    for (let i = 0; i < 5; i++) recordFailedAttempt(EMAIL);

    const res = await POST(credReq(), ctx);
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body).toMatchObject({ detail: "Too many attempts", code: "rate_limited" });
  });

  it("returns Retry-After header when rate limited", async () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(EMAIL);
    const res = await POST(credReq(), ctx);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });

  it("returns 429 when the IP is locked out (different email each time)", async () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(`login-ip:${IP}`);
    const res = await POST(credReq("other@example.com", IP), ctx);
    expect(res.status).toBe(429);
  });

  it("does not rate-limit different IPs independently", async () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(`login-ip:${IP}`);
    const otherIp = "10.0.0.2";
    clearFailedAttempts(`login-ip:${otherIp}`);
    const res = await POST(credReq(EMAIL, otherIp), ctx);
    // Mocked NextAuth → 200 for the unblocked IP
    expect(res.status).toBe(200);
  });
});

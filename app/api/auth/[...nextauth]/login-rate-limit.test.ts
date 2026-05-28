import { describe, it, expect, beforeEach, vi } from "vitest";

// Auth.js v5: mock the handlers export from @/auth
vi.mock("@/auth", () => ({
  handlers: {
    GET: async () => new Response("{}", { status: 200 }),
    POST: async () => new Response("{}", { status: 200 }),
  },
  auth: async () => null,
  signIn: async () => {},
  signOut: async () => {},
}));
vi.mock("@/lib/runtimeConfig", () => ({
  getNextAuthSecret: () => "test-secret",
  getBackendApiBaseUrl: () => "http://localhost:8000",
  getBackendInternalApiKey: () => "test-key",
}));
vi.mock("@/auth.config", () => ({ authConfig: {} }));

import { POST } from "./route";
import { clearFailedAttempts, recordFailedAttempt } from "@/lib/rateLimit";
import { NextRequest } from "next/server";

const IP = "10.0.0.1";
const EMAIL = "victim@example.com";

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

describe("login rate limiter — Auth.js v5 wrapper", () => {
  it("passes through when email is not rate-limited", async () => {
    const res = await POST(credReq());
    expect(res.status).toBe(200);
  });

  it("returns 429 when the email is already locked out", async () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(EMAIL);
    const res = await POST(credReq());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({ code: "rate_limited" });
  });

  it("returns Retry-After header when rate limited", async () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(EMAIL);
    const res = await POST(credReq());
    expect(res.headers.get("retry-after")).toBeTruthy();
  });

  it("returns 429 when the IP is locked out", async () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(`login-ip:${IP}`);
    const res = await POST(credReq("other@example.com", IP));
    expect(res.status).toBe(429);
  });

  it("does not rate-limit different IPs independently", async () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(`login-ip:${IP}`);
    const otherIp = "10.0.0.2";
    clearFailedAttempts(`login-ip:${otherIp}`);
    const res = await POST(credReq(EMAIL, otherIp));
    expect(res.status).toBe(200);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";

// Stub proxyBackend to simulate a permanently-down backend (503)
vi.mock("@/lib/serverApi", () => ({
  proxyBackend: vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ detail: "Service unavailable" }), { status: 503 })
  ),
}));

// Import AFTER mocks are registered
import { POST } from "./route";
import { clearFailedAttempts } from "@/lib/rateLimit";
import { NextRequest } from "next/server";

const IP = "10.0.0.99";

function makeRequest(body: unknown = {}) {
  return new NextRequest("http://localhost:3000/api/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": IP,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  clearFailedAttempts(`signup:${IP}`);
});

describe("signup rate limiter", () => {
  it("allows the first 5 requests regardless of body shape", async () => {
    for (let i = 0; i < 5; i++) {
      // body fails Zod validation → 400, but counter increments each time
      const res = await POST(makeRequest({ email: "bad" }));
      expect(res.status).not.toBe(429);
    }
  });

  it("blocks the 6th request with 429 after 5 failures (Zod validation errors)", async () => {
    for (let i = 0; i < 5; i++) {
      await POST(makeRequest({ email: "bad" }));
    }
    const res = await POST(makeRequest({ email: "bad" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({ detail: expect.stringContaining("Too many") });
  });

  it("blocks the 6th request even when the backend is down (5 × 503)", async () => {
    const validBody = {
      name: "Test User",
      email: "test@example.com",
      password: "secret1234",
    };
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest(validBody));
      // Backend is down → 503 but not 429 yet
      expect(res.status).toBe(503);
    }
    // 6th request: rate limiter fires before backend is called
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
  });

  it("returns Retry-After header when rate limited", async () => {
    for (let i = 0; i < 5; i++) await POST(makeRequest({ email: "bad" }));
    const res = await POST(makeRequest({ email: "bad" }));
    expect(res.headers.get("retry-after")).toBeTruthy();
  });
});

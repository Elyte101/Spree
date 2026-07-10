import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stub proxyBackend to simulate a successful backend signup.
vi.mock("@/lib/serverApi", () => ({
  proxyBackend: vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        id: "user-abc123",
        name: "Test User",
        email: "test@example.com",
        role: "customer",
        email_verified: false,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    )
  ),
}));

vi.mock("@/lib/runtimeConfig", () => ({
  getBackendApiBaseUrl: () => "http://localhost:8000/api/v1",
  getBackendInternalApiKey: () => "test-internal-key",
}));

const sendVerificationEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: (...args: unknown[]) => sendVerificationEmailMock(...args),
}));

// Import AFTER mocks are registered
import { POST } from "./route";
import { clearFailedAttempts } from "@/lib/rateLimit";
import { NextRequest } from "next/server";

const IP = "10.0.1.1";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": IP },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  clearFailedAttempts(`signup:${IP}`);
  sendVerificationEmailMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const validBody = { name: "Test User", email: "test@example.com", password: "secret1234" };

describe("signup → verification email (STEP 1, 2026-07-10 email flow assessment)", () => {
  it("triggers exactly one verification email on successful signup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: "verify-token-123" }), { status: 200 }))
    );

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(201);
    expect(sendVerificationEmailMock).toHaveBeenCalledTimes(1);
    expect(sendVerificationEmailMock).toHaveBeenCalledWith("test@example.com", "verify-token-123");
  });

  it("still returns 201 when the verification token request fails (non-fatal)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "error" }), { status: 500 }))
    );

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(201);
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });

  it("still returns 201 when sendVerificationEmail (Resend) throws (non-fatal)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: "verify-token-456" }), { status: 200 }))
    );
    sendVerificationEmailMock.mockRejectedValueOnce(new Error("Resend API down"));

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.email).toBe("test@example.com");
  });

  it("does not attempt to send a verification email when signup itself fails validation", async () => {
    vi.stubGlobal("fetch", vi.fn());

    const res = await POST(makeRequest({ email: "not-an-email" }));

    expect(res.status).toBe(400);
    expect(sendVerificationEmailMock).not.toHaveBeenCalled();
  });
});

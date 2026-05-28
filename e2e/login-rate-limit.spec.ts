import { test, expect } from "@playwright/test";

const CREDS_URL = "/api/auth/callback/credentials";
const BODY = new URLSearchParams({
  email: "ratelimit-e2e@example.com",
  password: "wrongpassword",
  csrfToken: "mock-token",
}).toString();
const HEADERS = { "Content-Type": "application/x-www-form-urlencoded" };

test.describe("Login rate limiter — live server", () => {
  test("6th consecutive attempt returns 429 with rate_limited code", async ({ request }) => {
    // First 5 attempts — NextAuth may return 200 or a redirect; not 429
    for (let i = 0; i < 5; i++) {
      const res = await request.post(CREDS_URL, { data: BODY, headers: HEADERS });
      expect(res.status()).not.toBe(429);
    }

    // 6th attempt must be blocked
    const res = await request.post(CREDS_URL, { data: BODY, headers: HEADERS });
    expect(res.status()).toBe(429);

    const body = await res.json();
    expect(body).toMatchObject({ detail: "Too many attempts", code: "rate_limited" });
  });

  test("429 response includes Retry-After header", async ({ request }) => {
    for (let i = 0; i < 5; i++) {
      await request.post(CREDS_URL, { data: BODY, headers: HEADERS });
    }
    const res = await request.post(CREDS_URL, { data: BODY, headers: HEADERS });
    expect(res.status()).toBe(429);
    expect(res.headers()["retry-after"]).toBeTruthy();
  });
});

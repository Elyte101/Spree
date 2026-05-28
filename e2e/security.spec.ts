import { test, expect } from "@playwright/test";

// Base URL defaults to http://localhost:3000 (set in playwright.config.ts)

test.describe("Security headers", () => {
  test("home page returns HSTS and CSP-Report-Only headers", async ({ request }) => {
    const response = await request.get("/");
    expect(response.headers()["strict-transport-security"]).toContain("max-age=");
    expect(response.headers()["content-security-policy-report-only"]).toContain("default-src");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    // X-Powered-By must be absent (fingerprint suppression)
    expect(response.headers()["x-powered-by"]).toBeUndefined();
  });
});

test.describe("Auth API — unauthenticated access", () => {
  test("POST /api/orders returns 401 without session", async ({ request }) => {
    const response = await request.post("/api/orders", {
      data: { items: [] },
    });
    expect(response.status()).toBe(401);
  });

  test("POST /api/orders/initialize-payment returns 401 without session", async ({ request }) => {
    const response = await request.post("/api/orders/initialize-payment", {
      data: { items: [] },
    });
    expect(response.status()).toBe(401);
  });
});

test.describe("Signup validation", () => {
  test("POST /api/auth/signup rejects invalid email with 400", async ({ request }) => {
    const response = await request.post("/api/auth/signup", {
      data: { name: "Test", email: "not-an-email", password: "secret123" },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("detail");
  });

  test("POST /api/auth/signup rejects short password with 400", async ({ request }) => {
    const response = await request.post("/api/auth/signup", {
      data: { name: "Test", email: "test@example.com", password: "abc" },
    });
    expect(response.status()).toBe(400);
  });

  test("POST /api/auth/signup rejects non-JSON body with 400", async ({ request }) => {
    const response = await request.post("/api/auth/signup", {
      headers: { "Content-Type": "application/json" },
      data: "not json at all",
    });
    // Playwright serialises the string as a quoted JSON string — backend may return 400 or 422
    expect([400, 422].includes(response.status())).toBeTruthy();
  });
});

test.describe("Open-redirect prevention", () => {
  test("callbackUrl to external domain is ignored", async ({ request }) => {
    // NextAuth should redirect to baseUrl, not to the external URL
    const response = await request.get(
      "/api/auth/signin?callbackUrl=https://evil.com",
      { maxRedirects: 0 }
    );
    // NextAuth returns a redirect; Location header must not be evil.com
    const location = response.headers()["location"] ?? "";
    expect(location).not.toContain("evil.com");
  });
});

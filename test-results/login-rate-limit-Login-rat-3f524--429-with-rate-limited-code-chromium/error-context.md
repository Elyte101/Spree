# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login-rate-limit.spec.ts >> Login rate limiter — live server >> 6th consecutive attempt returns 429 with rate_limited code
- Location: e2e/login-rate-limit.spec.ts:12:7

# Error details

```
Error: expect(received).toMatchObject(expected)

- Expected  - 1
+ Received  + 1

  Object {
    "code": "rate_limited",
-   "detail": "Too many attempts",
+   "detail": "Too many login attempts. Please try again later.",
  }
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | const CREDS_URL = "/api/auth/callback/credentials";
  4  | const BODY = new URLSearchParams({
  5  |   email: "ratelimit-e2e@example.com",
  6  |   password: "wrongpassword",
  7  |   csrfToken: "mock-token",
  8  | }).toString();
  9  | const HEADERS = { "Content-Type": "application/x-www-form-urlencoded" };
  10 | 
  11 | test.describe("Login rate limiter — live server", () => {
  12 |   test("6th consecutive attempt returns 429 with rate_limited code", async ({ request }) => {
  13 |     // First 5 attempts — NextAuth may return 200 or a redirect; not 429
  14 |     for (let i = 0; i < 5; i++) {
  15 |       const res = await request.post(CREDS_URL, { data: BODY, headers: HEADERS });
  16 |       expect(res.status()).not.toBe(429);
  17 |     }
  18 | 
  19 |     // 6th attempt must be blocked
  20 |     const res = await request.post(CREDS_URL, { data: BODY, headers: HEADERS });
  21 |     expect(res.status()).toBe(429);
  22 | 
  23 |     const body = await res.json();
> 24 |     expect(body).toMatchObject({ detail: "Too many attempts", code: "rate_limited" });
     |                  ^ Error: expect(received).toMatchObject(expected)
  25 |   });
  26 | 
  27 |   test("429 response includes Retry-After header", async ({ request }) => {
  28 |     for (let i = 0; i < 5; i++) {
  29 |       await request.post(CREDS_URL, { data: BODY, headers: HEADERS });
  30 |     }
  31 |     const res = await request.post(CREDS_URL, { data: BODY, headers: HEADERS });
  32 |     expect(res.status()).toBe(429);
  33 |     expect(res.headers()["retry-after"]).toBeTruthy();
  34 |   });
  35 | });
  36 | 
```
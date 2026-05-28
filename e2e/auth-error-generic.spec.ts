import { test, expect } from "@playwright/test";

const ERROR_VALUES = ["CredentialsSignin", "OAuthSignin", "Verification"];

test.describe("Auth error page — static, no ?error= reflection", () => {
  test("returns byte-identical HTML regardless of ?error= value", async ({ request }) => {
    const bodies = await Promise.all(
      ERROR_VALUES.map((e) =>
        request.get(`/auth/error?error=${e}`).then((r) => r.text())
      )
    );

    // All responses must be identical
    for (let i = 1; i < bodies.length; i++) {
      expect(bodies[i]).toBe(bodies[0]);
    }
  });

  test("page title is 'Sign in failed'", async ({ page }) => {
    await page.goto("/auth/error?error=CredentialsSignin");
    await expect(page).toHaveTitle(/Sign in failed/i);
  });

  test("body never contains the error query param value", async ({ request }) => {
    for (const errorValue of ERROR_VALUES) {
      const html = await request
        .get(`/auth/error?error=${errorValue}`)
        .then((r) => r.text());
      expect(html).not.toContain(errorValue);
    }
  });

  test("page has a link back to sign-in", async ({ page }) => {
    await page.goto("/auth/error");
    await expect(page.getByRole("link", { name: /back to sign.?in/i })).toBeVisible();
  });
});

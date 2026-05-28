import { test, expect } from "@playwright/test";

const VARIANTS = [
  "/auth/error?error=CredentialsSignin",
  "/auth/error?error=Verification",
  "/auth/error?error=ZZZUNIQUEZZZ",
  "/auth/error",
];

test.describe("Auth error page — static, no ?error= reflection", () => {
  test("all four URL variants return byte-identical bodies", async ({ request }) => {
    const bodies = await Promise.all(
      VARIANTS.map((url) => request.get(url).then((r) => r.text()))
    );

    // Every body must be the same length and content
    for (let i = 1; i < bodies.length; i++) {
      expect(bodies[i].length, `byte length mismatch between variant 0 and ${i}`).toBe(
        bodies[0].length
      );
      expect(bodies[i], `body mismatch between variant 0 and ${i}`).toBe(bodies[0]);
    }
  });

  test("ZZZUNIQUEZZZ does not appear anywhere in the HTML", async ({ request }) => {
    const html = await request.get("/auth/error?error=ZZZUNIQUEZZZ").then((r) => r.text());
    expect(html).not.toContain("ZZZUNIQUEZZZ");
  });

  test("page title is 'Sign in failed'", async ({ page }) => {
    await page.goto("/auth/error?error=CredentialsSignin");
    await expect(page).toHaveTitle(/Sign in failed/i);
  });

  test("body never contains any of the error query param values", async ({ request }) => {
    for (const errorValue of ["CredentialsSignin", "Verification", "ZZZUNIQUEZZZ"]) {
      const html = await request
        .get(`/auth/error?error=${errorValue}`)
        .then((r) => r.text());
      expect(html).not.toContain(errorValue);
    }
  });

  test("page renders 'Sign in failed' heading and generic description", async ({ page }) => {
    await page.goto("/auth/error?error=CredentialsSignin");
    await expect(page.getByRole("heading", { name: "Sign in failed" })).toBeVisible();
    await expect(page.getByText(/Please try again or contact support/)).toBeVisible();
  });

  test("page has a link back to sign-in", async ({ page }) => {
    await page.goto("/auth/error");
    await expect(page.getByRole("link", { name: /back to sign.?in/i })).toBeVisible();
  });
});

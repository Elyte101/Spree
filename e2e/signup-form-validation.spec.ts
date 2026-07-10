import { test, expect } from "@playwright/test";

async function openSignupTab(page: import("@playwright/test").Page) {
  await page.goto("/auth/sign-in");
  await page.getByRole("button", { name: "Sign up" }).click();
}

test.describe("Sign-up form — validation and error handling", () => {
  test("mismatched passwords show an inline error that clears when corrected", async ({ page }) => {
    await openSignupTab(page);

    await page.locator("#signup-name").fill("Jane Doe");
    await page.locator("#auth-email").fill("jane@example.com");
    await page.locator("#auth-password").fill("correcthorse1");
    await page.locator("#signup-confirm-password").fill("somethingElse1");
    await page.getByLabel(/I agree to Spree/i).check();

    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Passwords do not match")).toBeVisible();

    // Fix to matching-but-short — must show the length error, not a stale mismatch.
    await page.locator("#auth-password").fill("short1");
    await page.locator("#signup-confirm-password").fill("short1");
    await expect(page.getByText("Passwords do not match")).not.toBeVisible();

    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
    await expect(page.getByText("Passwords do not match")).not.toBeVisible();
  });

  test("short password is rejected client-side with no network request", async ({ page }) => {
    await openSignupTab(page);

    let signupRequested = false;
    await page.route("**/api/auth/signup", (route) => {
      signupRequested = true;
      return route.continue();
    });

    await page.locator("#signup-name").fill("Jane Doe");
    await page.locator("#auth-email").fill("jane@example.com");
    await page.locator("#auth-password").fill("short1");
    await page.locator("#signup-confirm-password").fill("short1");
    await page.getByLabel(/I agree to Spree/i).check();

    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
    expect(signupRequested).toBe(false);
  });

  test("invalid email shows an inline error", async ({ page }) => {
    await openSignupTab(page);

    await page.locator("#signup-name").fill("Jane Doe");
    await page.locator("#auth-email").fill("not-an-email");
    await page.locator("#auth-password").fill("correcthorse1");
    await page.locator("#signup-confirm-password").fill("correcthorse1");
    await page.getByLabel(/I agree to Spree/i).check();

    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Enter a valid email address")).toBeVisible();
  });

  test("empty submit shows a required message per empty field", async ({ page }) => {
    await openSignupTab(page);

    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Please enter your full name")).toBeVisible();
    await expect(page.getByText("Please enter your email address")).toBeVisible();
    await expect(page.getByText("Please enter a password")).toBeVisible();
    await expect(page.getByText("Please confirm your password")).toBeVisible();
  });

  test("submitting without checking the terms box shows an inline required error", async ({ page }) => {
    await openSignupTab(page);

    let signupRequested = false;
    await page.route("**/api/auth/signup", (route) => {
      signupRequested = true;
      return route.continue();
    });

    await page.locator("#signup-name").fill("Jane Doe");
    await page.locator("#auth-email").fill("jane@example.com");
    await page.locator("#auth-password").fill("correcthorse1");
    await page.locator("#signup-confirm-password").fill("correcthorse1");

    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Please accept the Terms of Service and Privacy Policy")).toBeVisible();
    expect(signupRequested).toBe(false);

    await page.getByLabel(/I agree to Spree/i).check();
    await expect(
      page.getByText("Please accept the Terms of Service and Privacy Policy")
    ).not.toBeVisible();
  });

  test("duplicate email (409) shows a friendly 'already exists' message", async ({ page }) => {
    await openSignupTab(page);

    await page.route("**/api/auth/signup", (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ detail: "An account already exists for that email address" }),
      })
    );

    await page.locator("#signup-name").fill("Jane Doe");
    await page.locator("#auth-email").fill("existing@example.com");
    await page.locator("#auth-password").fill("correcthorse1");
    await page.locator("#signup-confirm-password").fill("correcthorse1");
    await page.getByLabel(/I agree to Spree/i).check();

    await page.getByRole("button", { name: "Create account" }).click();

    await expect(
      page.getByText("An account with this email already exists. Try signing in.")
    ).toBeVisible();
    await expect(page.getByText("This email is already registered")).toBeVisible();
  });

  test("structured validation errors[] never surface the raw 'Validation failed' string", async ({ page }) => {
    await openSignupTab(page);

    await page.route("**/api/auth/signup", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          detail: "Validation failed",
          code: "validation_error",
          errors: [{ path: "email", code: "invalid_format" }],
        }),
      })
    );

    await page.locator("#signup-name").fill("Jane Doe");
    await page.locator("#auth-email").fill("jane@example.com");
    await page.locator("#auth-password").fill("correcthorse1");
    await page.locator("#signup-confirm-password").fill("correcthorse1");
    await page.getByLabel(/I agree to Spree/i).check();

    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText(/^validation failed$/i)).not.toBeVisible();
  });
});

test.describe("Sign-in tab — consistent validation and error handling", () => {
  test("empty submit shows per-field required messages", async ({ page }) => {
    await page.goto("/auth/sign-in");

    await page.locator('form button[type="submit"]').click();

    await expect(page.getByText("Please enter your email address")).toBeVisible();
    await expect(page.getByText("Please enter your password")).toBeVisible();
  });

  test("filling a field clears its inline required error", async ({ page }) => {
    await page.goto("/auth/sign-in");

    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText("Please enter your email address")).toBeVisible();

    await page.locator("#auth-email").fill("someone@example.com");
    await expect(page.getByText("Please enter your email address")).not.toBeVisible();
  });

  test("switching tabs clears stale errors from the other tab", async ({ page }) => {
    await page.goto("/auth/sign-in");

    await page.locator('form button[type="submit"]').click();
    await expect(page.getByText("Please enter your email address")).toBeVisible();

    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.getByText("Please enter your email address")).not.toBeVisible();
  });
});

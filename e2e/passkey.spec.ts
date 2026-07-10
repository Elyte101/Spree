import { test, expect, type Page } from "@playwright/test";

// Uses Chrome DevTools Protocol's WebAuthn domain to add a virtual
// authenticator so the real registration/authentication ceremony runs end
// to end (real @simplewebauthn/browser calls, real backend py_webauthn
// verification) without a physical security key. Chromium-only — matches
// this repo's single "chromium" Playwright project.
async function addVirtualAuthenticator(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

test.describe("Passkeys — live server, real WebAuthn ceremony via CDP virtual authenticator", () => {
  test("register a passkey on /profile, sign out, then sign back in with it", async ({ page }) => {
    await addVirtualAuthenticator(page);

    const email = `passkey-e2e-${Date.now()}@example.com`;
    const password = "correcthorse1";

    await page.goto("/auth/sign-in");
    await page.getByRole("button", { name: "Sign up" }).click();
    await page.locator("#signup-name").fill("Passkey Tester");
    await page.locator("#auth-email").fill(email);
    await page.locator("#auth-password").fill(password);
    await page.locator("#signup-confirm-password").fill(password);
    await page.getByLabel(/I agree to Spree/i).check();
    await page.getByRole("button", { name: "Create account" }).click();

    await page.waitForURL("**/profile");

    await page.getByRole("button", { name: "Add a passkey" }).click();
    // "Remove passkey" only renders once a registered credential appears in
    // the list — unlike text like "added", which also matches the
    // "No passkeys added yet." empty-state and would false-positive
    // immediately, before the ceremony actually completes.
    await expect(page.getByRole("button", { name: "Remove passkey" })).toBeVisible({ timeout: 10_000 });

    // Navigate straight to /auth/sign-in once the sign-out call itself
    // resolves, rather than letting the client's callbackUrl redirect land
    // on "/" first — the home page's product grid is unrelated to this
    // ceremony and isn't worth the extra page load here.
    const signOutResponse = page.waitForResponse(
      (res) => res.url().includes("/api/auth/signout") && res.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Sign out" }).click();
    await signOutResponse;

    await page.goto("/auth/sign-in");
    await page.getByRole("button", { name: "Use Passkey" }).click();

    await page.waitForURL("**/profile", { timeout: 10_000 });
    await expect(page.getByLabel("Email")).toHaveValue(email);
  });
});

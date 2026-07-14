import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "fs";
import path from "path";

/**
 * Reads a var from process.env, falling back to .env.local (which the
 * Playwright process doesn't load automatically — only `next dev` does).
 * Mirrors the SEED_ADMIN_* convenience already baked into init_db.py for
 * local/dev/test environments.
 */
function readEnvVar(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const envLocal = readFileSync(path.resolve(__dirname, "../.env.local"), "utf-8");
    const match = envLocal.match(new RegExp(`^${name}=["']?([^"'\n]+)["']?`, "m"));
    return match?.[1];
  } catch {
    return undefined;
  }
}

const ADMIN_EMAIL = readEnvVar("SEED_ADMIN_EMAIL");
const ADMIN_PASSWORD = readEnvVar("SEED_ADMIN_PASSWORD");

// A local, same-origin asset — guaranteed to load without depending on any
// external network access, so the test isn't flaky in sandboxed/offline runners.
const TEST_IMAGE = "/spree-logo.png";
const PRODUCT_NAME = `Hover Fade Test ${Date.now()}`;

let productId: string | null = null;

test.beforeAll(async ({ browser }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "No seed admin credentials available in this environment.");

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("/auth/sign-in");
  await page.locator("#auth-email").fill(ADMIN_EMAIL!);
  await page.locator("#auth-password").fill(ADMIN_PASSWORD!);
  await page.locator('button[type="submit"]', { hasText: "Sign in" }).click();
  await page.waitForURL("**/profile", { timeout: 15000 });

  const response = await page.request.post("/api/products", {
    data: {
      name: PRODUCT_NAME,
      description: "Fixture product for the product-card hover-fade regression test.",
      price: 10,
      discount: 0,
      images: [TEST_IMAGE, TEST_IMAGE],
      categoryName: `Hover Test Category ${Date.now()}`,
      brandName: `Hover Test Brand ${Date.now()}`,
      stock: 5,
      variants: [],
      colors: [],
      sizes: [],
      tags: [],
    },
  });

  if (response.ok()) {
    const body = await response.json();
    productId = body.id;
  }

  await context.close();
});

test.afterAll(async ({ browser }) => {
  if (!productId || !ADMIN_EMAIL || !ADMIN_PASSWORD) return;

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/auth/sign-in");
  await page.locator("#auth-email").fill(ADMIN_EMAIL);
  await page.locator("#auth-password").fill(ADMIN_PASSWORD);
  await page.locator('button[type="submit"]', { hasText: "Sign in" }).click();
  await page.waitForURL("**/profile", { timeout: 15000 });
  await page.request.delete(`/api/products/${productId}`);
  await context.close();
});

async function getFirstCardImageOpacity(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const card = document.querySelector(".MuiCard-root");
    const el = card?.querySelector(sel);
    return el ? getComputedStyle(el).opacity : null;
  }, selector);
}

test("product card image opacity survives a fast hover-in then hover-out", async ({ page }) => {
  test.skip(!productId, "Fixture product was not created (see beforeAll skip/failure reason).");

  await page.goto(`/products?search=${encodeURIComponent(PRODUCT_NAME)}`);
  await page.waitForSelector(".MuiCard-root img");

  // Let the primary image actually finish loading before testing hover behavior.
  await expect
    .poll(async () => getFirstCardImageOpacity(page, "img"), { timeout: 10000 })
    .toBe("1");

  // Fast, real mouseenter immediately followed by mouseleave. Using
  // page.mouse.move (real pointer input Chromium/React treat identically to
  // genuine user movement) rather than dispatching synthetic mouseenter/
  // mouseleave events directly, since those don't bubble and may not be
  // picked up the same way React's delegated listeners are. The two moves
  // are issued back-to-back with no wait in between, reproducing the exact
  // race that used to leave the image stuck at opacity: 0.
  const card = page.locator(".MuiCard-root").first();
  const box = await card.boundingBox();
  if (!box) throw new Error("Product card did not render a bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width + 200, box.y + box.height + 200);

  // Give any CSS transitions (0.2s/0.25s) time to settle.
  await page.waitForTimeout(500);

  const primaryOpacity = await getFirstCardImageOpacity(page, "img");
  expect(primaryOpacity).toBe("1");

  // The hover-preview overlay should also be back to its resting (hidden) state.
  const overlayOpacity = await page.evaluate(() => {
    const overlay = document.querySelector(".product-card-hover-preview");
    return overlay ? getComputedStyle(overlay).opacity : null;
  });
  expect(overlayOpacity).toBe("0");
});

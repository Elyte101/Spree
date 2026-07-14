import { test, expect } from "@playwright/test";

test.describe("Store page robustness", () => {
  test("a nonexistent store slug returns a real 404, not a crash", async ({ page }) => {
    const response = await page.goto("/stores/this-store-does-not-exist-12345");
    expect(response?.status()).toBe(404);
  });

  test("a seller with no storeSlug never gets a /stores/... link on their product page", async ({
    page,
    request,
  }) => {
    // Pick any product whose seller has no store record — this reproduces the
    // exact shape that used to 404 (link built from sellerId instead of storeSlug).
    const catalog = await request.get("/api/products?limit=12").then((r) => r.json());
    const productWithoutStore = catalog.items.find(
      (p: { storeSlug: string | null; sellerId: string | null }) => !p.storeSlug && p.sellerId
    );
    test.skip(!productWithoutStore, "No storeless-seller product in this catalog to check against.");
    if (!productWithoutStore) return;

    await page.goto(`/products/${productWithoutStore.slug}`);
    // No link should ever point at /stores/<sellerId> (or any /stores/ path at all,
    // since this product's seller has no storeSlug).
    await expect(page.locator(`a[href="/stores/${productWithoutStore.sellerId}"]`)).toHaveCount(0);
    await expect(page.locator('a[href^="/stores/"]')).toHaveCount(0);
  });

  test("a seller with a real storeSlug renders their store page", async ({ page, request }) => {
    // /api/vendors (the Next proxy) is admin-gated, but the underlying
    // backend GET /sellers is public — call it directly rather than
    // authenticating just to read a public list.
    const backendUrl = process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000/api/v1";
    const sellers = await request.get(`${backendUrl}/sellers`).then((r) => r.json());
    const withStore = sellers.find((s: { storeSlug: string }) => s.storeSlug);
    test.skip(!withStore, "No seller with a storeSlug in this environment — nothing to check.");
    if (!withStore) return;

    const response = await page.goto(`/stores/${withStore.storeSlug}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByText(withStore.storeName, { exact: false }).first()).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";

const SEEDED_CART = JSON.stringify({
  state: {
    cart: {
      id: "cart-test",
      items: [
        {
          id: "item-1",
          productId: "1",
          name: "Test Product",
          image: "https://picsum.photos/200",
          price: 29.99,
          quantity: 1,
          color: null,
          size: null,
          isPreorder: false,
        },
      ],
      itemCount: 1,
      subtotal: 29.99,
      shipping: 12,
      standardShipping: 12,
      tax: 2.4,
      total: 44.39,
      currency: "GHS",
    },
  },
  version: 0,
});

test.describe("Checkout — PCI compliance: no raw card inputs", () => {
  test.beforeEach(async ({ page }) => {
    // Seed the cart in localStorage before navigating to /checkout
    await page.goto("/");
    await page.evaluate((cartJson) => {
      localStorage.setItem("spree-cart", cartJson);
    }, SEEDED_CART);
  });

  test("no input has placeholder/name/id matching card-related terms", async ({ page }) => {
    await page.goto("/checkout");

    const inputs = page.locator("input");
    const count = await inputs.count();

    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const placeholder = (await input.getAttribute("placeholder")) ?? "";
      const name = (await input.getAttribute("name")) ?? "";
      const id = (await input.getAttribute("id")) ?? "";
      const combined = `${placeholder} ${name} ${id}`;

      expect(combined, `input #${i} matched card-related pattern`).not.toMatch(
        /card|cvc|cvv|expiry|name on/i
      );
    }
  });

  test("payment section mentions Paystack but has no card form", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page.getByText(/paystack/i).first()).toBeVisible();
    await expect(page.locator('input[placeholder*="1234"]')).toHaveCount(0);
    await expect(page.locator('input[placeholder="MM / YY"]')).toHaveCount(0);
    await expect(page.locator('input[placeholder="···"]')).toHaveCount(0);
  });
});

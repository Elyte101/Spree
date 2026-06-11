import { describe, it, expect } from "vitest";
import { CreateOrderSchema } from "./order";

const validItem = {
  productId: "prod-1",
  name: "Test Product",
  image: "https://example.com/img.jpg",
  price: 29.99,
  quantity: 1,
};

const validOrder = {
  fullName: "Kofi Mensah",
  email: "kofi@example.com",
  phone: "+233201234567",
  addressLine1: "12 Accra Street",
  city: "Accra",
  state: "Greater Accra",
  postalCode: "GA-123",
  country: "Ghana",
  shippingMethod: "standard",
  paymentMethod: "paystack",
  subtotal: 29.99,
  shippingCost: 12,
  tax: 2.4,
  total: 44.39,
  currency: "$",
  items: [validItem],
};

describe("CreateOrderSchema", () => {
  it("accepts a valid order", () => {
    expect(CreateOrderSchema.safeParse(validOrder).success).toBe(true);
  });

  it("rejects empty items array", () => {
    const result = CreateOrderSchema.safeParse({ ...validOrder, items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = CreateOrderSchema.safeParse({ ...validOrder, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects zero or negative quantity", () => {
    const result = CreateOrderSchema.safeParse({
      ...validOrder,
      items: [{ ...validItem, quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative prices", () => {
    const result = CreateOrderSchema.safeParse({ ...validOrder, subtotal: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects currency that is not 3 characters", () => {
    const result = CreateOrderSchema.safeParse({ ...validOrder, currency: "$I" });
    expect(result.success).toBe(false);
  });

  it("allows optional fields to be omitted", () => {
    const { phone, addressLine2, ...withoutOptional } = validOrder as typeof validOrder & { addressLine2?: string };
    expect(CreateOrderSchema.safeParse(withoutOptional).success).toBe(true);
  });

  it("rejects missing required address fields", () => {
    const result = CreateOrderSchema.safeParse({ ...validOrder, city: "" });
    expect(result.success).toBe(false);
  });
});

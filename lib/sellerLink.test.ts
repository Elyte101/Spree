import { describe, it, expect } from "vitest";
import { getSellerStoreHref } from "./sellerLink";

describe("getSellerStoreHref", () => {
  it("links to /stores/<storeSlug> when a store slug is present", () => {
    expect(getSellerStoreHref({ storeSlug: "boateng-electronics" })).toBe(
      "/stores/boateng-electronics"
    );
  });

  it("returns null when storeSlug is null — never falls back to a raw seller/user id", () => {
    expect(getSellerStoreHref({ storeSlug: null })).toBeNull();
  });

  it("returns null when storeSlug is undefined", () => {
    expect(getSellerStoreHref({})).toBeNull();
  });

  it("returns null for an empty-string storeSlug", () => {
    expect(getSellerStoreHref({ storeSlug: "" })).toBeNull();
  });
});

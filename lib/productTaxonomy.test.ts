import { describe, it, expect } from "vitest";
import type { Category } from "@/types/types";
import { EMPTY_CATEGORY_PATH, categoryPathFor, categoryPicker } from "./productTaxonomy";

const cat = (id: string, slug: string, parentId: string | null = null): Category => ({
  id,
  name: id,
  slug,
  image: "",
  itemCount: 0,
  parentId,
});

// Mirrors production after the umbrella migration: department -> category -> subcategory,
// plus one category with no subcategories and one stray top-level category with no children.
const TREE: Category[] = [
  cat("electronics", "electronics"),
  cat("phones", "phones-accessories", "electronics"),
  cat("smartphones", "phones-accessories-smartphones", "phones"),
  cat("chargers", "phones-accessories-chargers-cables", "phones"),
  cat("tech", "tech", "electronics"),
  cat("stray", "stray"),
];

describe("categoryPicker", () => {
  it("offers only departments until one is picked", () => {
    const picker = categoryPicker(TREE, EMPTY_CATEGORY_PATH);
    expect(picker.departments.map((c) => c.id)).toEqual(["electronics", "stray"]);
    expect(picker.categoryOptions).toEqual([]);
    expect(picker.sizeCategory).toBeUndefined();
    expect(picker.productCategoryId).toBe("");
  });

  it("requires a subcategory when the category has some, and keys sizes on the middle level", () => {
    const partial = categoryPicker(TREE, { departmentId: "electronics", categoryId: "phones", subcategoryId: "" });
    expect(partial.subcategoryOptions.map((c) => c.id)).toEqual(["smartphones", "chargers"]);
    expect(partial.sizeCategory?.slug).toBe("phones-accessories");
    expect(partial.productCategoryId).toBe("");

    const full = categoryPicker(TREE, { departmentId: "electronics", categoryId: "phones", subcategoryId: "smartphones" });
    expect(full.sizeCategory?.slug).toBe("phones-accessories");
    expect(full.productCategoryId).toBe("smartphones");
  });

  it("saves the category itself when it has no subcategories", () => {
    const picker = categoryPicker(TREE, { departmentId: "electronics", categoryId: "tech", subcategoryId: "" });
    expect(picker.subcategoryOptions).toEqual([]);
    expect(picker.productCategoryId).toBe("tech");
  });

  it("never saves a department that has categories under it", () => {
    const picker = categoryPicker(TREE, { departmentId: "electronics", categoryId: "", subcategoryId: "" });
    expect(picker.productCategoryId).toBe("");
  });

  it("lets a childless top-level category stand in as its own category", () => {
    const picker = categoryPicker(TREE, { departmentId: "stray", categoryId: "", subcategoryId: "" });
    expect(picker.sizeCategory?.id).toBe("stray");
    expect(picker.productCategoryId).toBe("stray");
  });
});

describe("categoryPathFor", () => {
  it("rebuilds the full path from a subcategory", () => {
    expect(categoryPathFor(TREE, "smartphones")).toEqual({
      departmentId: "electronics",
      categoryId: "phones",
      subcategoryId: "smartphones",
    });
  });

  it("rebuilds a two-level path from a category filed without a subcategory", () => {
    expect(categoryPathFor(TREE, "tech")).toEqual({ departmentId: "electronics", categoryId: "tech", subcategoryId: "" });
  });

  it("returns an empty path for an unknown category", () => {
    expect(categoryPathFor(TREE, "missing")).toEqual(EMPTY_CATEGORY_PATH);
  });
});

import type { Metadata } from "next";
import { ProductListingPage } from "@/components/product/productListingPage";
import { getBrands, getCollections, getHomeFeed, getProducts } from "@/lib/serverApi";

export const metadata: Metadata = {
  title: "Products | Spree",
  description: "Browse Spree's live ecommerce catalog",
};

const PRODUCTS_PER_PAGE = 12;

export default async function ProductsPage() {
  const [homeFeed, brands, collections, initialCatalog] = await Promise.all([
    getHomeFeed(),
    getBrands(),
    getCollections(),
    getProducts({ limit: PRODUCTS_PER_PAGE }),
  ]);

  return (
    <ProductListingPage
      initialCatalog={initialCatalog}
      homeFeed={homeFeed}
      brands={brands}
      collections={collections}
    />
  );
}

import type { Metadata } from "next";
import { ProductListingPage } from "@/components/product/productListingPage";
import { getBrands, getCollections, getHomeFeed, getProducts } from "@/lib/serverApi";

export const metadata: Metadata = {
  title: "Products | Spree",
  description: "Browse Spree's live ecommerce catalog",
};

const PRODUCTS_PER_PAGE = 12;

interface PageProps {
  searchParams: Promise<{ search?: string }>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const { search = "" } = await searchParams;

  const [homeFeed, brands, collections, initialCatalog] = await Promise.all([
    getHomeFeed(),
    getBrands(),
    getCollections(),
    getProducts({ limit: PRODUCTS_PER_PAGE, ...(search ? { search } : {}) }),
  ]);

  return (
    <ProductListingPage
      initialCatalog={initialCatalog}
      homeFeed={homeFeed}
      brands={brands}
      collections={collections}
      initialSearch={search}
    />
  );
}

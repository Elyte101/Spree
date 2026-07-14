import type { Metadata } from "next";
import { ProductListingPage } from "@/components/product/productListingPage";
import { CATALOG_REVALIDATE_SECONDS, getBrands, getCollections, getHomeFeed, getProducts, getSellerLocations } from "@/lib/serverApi";

export const metadata: Metadata = {
  title: "Products | Spree",
  description: "Browse Spree's live ecommerce catalog",
};

// Cold-start mitigation: this route reads `searchParams`, which still forces
// a per-request render regardless of this value — but the underlying catalog
// fetches are now cacheable (see lib/serverApi.ts), so the common case (no
// search query) is served from Next's fetch cache instead of hitting the
// backend fresh every time. Must be a literal (Next statically analyzes this
// export at build time) — keep in sync with CATALOG_REVALIDATE_SECONDS below.
export const revalidate = 60;

const PRODUCTS_PER_PAGE = 12;

interface PageProps {
  searchParams: Promise<{ search?: string }>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const { search = "" } = await searchParams;

  const [homeFeed, brands, collections, sellerLocations, initialCatalog] = await Promise.all([
    getHomeFeed(),
    getBrands(),
    getCollections(),
    getSellerLocations(),
    getProducts(
      { limit: PRODUCTS_PER_PAGE, ...(search ? { search } : {}) },
      undefined,
      { revalidateSeconds: CATALOG_REVALIDATE_SECONDS }
    ),
  ]);

  return (
    <ProductListingPage
      initialCatalog={initialCatalog}
      homeFeed={homeFeed}
      brands={brands}
      collections={collections}
      sellerLocations={sellerLocations}
      initialSearch={search}
    />
  );
}

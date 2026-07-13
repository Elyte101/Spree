import { LandingPage } from "@/components/home/landingPage";
import { CATALOG_REVALIDATE_SECONDS, getHomeFeed, getProducts } from "@/lib/serverApi";

// Cold-start mitigation: no cookies/headers/searchParams here, so with the
// underlying fetches now cacheable (see lib/serverApi.ts), this route can be
// served from Next's cache instead of a fresh render + backend round trip
// on every request. Must be a literal (Next statically analyzes this export
// at build time) — keep in sync with CATALOG_REVALIDATE_SECONDS below.
export const revalidate = 60;

export default async function Home() {
  const [homeFeed, catalog] = await Promise.all([
    getHomeFeed(),
    getProducts({ limit: 12, sort: "featured" }, undefined, { revalidateSeconds: CATALOG_REVALIDATE_SECONDS }),
  ]);
  const averageRating =
    catalog.items.reduce((sum, product) => sum + product.rating, 0) /
    Math.max(catalog.items.length, 1);

  // Deduplicate: never show the same product in both Featured and Just In.
  const featuredProducts = homeFeed.featuredProducts.slice(0, 4);
  const featuredIds = new Set(featuredProducts.map((p) => p.id));
  const newArrivals = homeFeed.newArrivals
    .filter((p) => !featuredIds.has(p.id))
    .slice(0, 3);

  return (
    <LandingPage
      homeFeed={homeFeed}
      featuredProducts={featuredProducts}
      newArrivals={newArrivals}
      totalProducts={catalog.total}
      averageRating={averageRating}
    />
  );
}

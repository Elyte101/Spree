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
  // Only average products that actually have reviews — diluting with
  // unreviewed products (rating defaults to 0) was pinning this near 0 and
  // permanently showing the "New" placeholder even once real ratings existed.
  const ratedItems = catalog.items.filter((product) => product.reviewsCount > 0);
  const averageRating = ratedItems.length
    ? ratedItems.reduce((sum, product) => sum + product.rating, 0) / ratedItems.length
    : 0;

  // Featured and Fresh arrivals are independent curations (is_featured flag
  // vs. recency) and can legitimately overlap — a product can be both. This
  // used to exclude anything already in the first 4 Featured products from
  // Fresh arrivals, which meant Fresh arrivals silently became "products not
  // in Featured" instead of "newest products": with every current product
  // tagged featured, whichever one didn't make the top-4 Featured slice
  // (which sorts featured desc, created_at desc, rating desc — not purely by
  // recency) ended up as the only "fresh arrival" shown, regardless of how
  // old it actually was.
  const featuredProducts = homeFeed.featuredProducts.slice(0, 4);
  const newArrivals = homeFeed.newArrivals.slice(0, 3);

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

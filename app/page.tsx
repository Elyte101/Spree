import { LandingPage } from "@/components/home/landingPage";
import { getHomeFeed, getProducts } from "@/lib/serverApi";

export default async function Home() {
  const [homeFeed, catalog] = await Promise.all([
    getHomeFeed(),
    getProducts({ limit: 12, sort: "featured" }),
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

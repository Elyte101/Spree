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

  return (
    <LandingPage
      homeFeed={homeFeed}
      featuredProducts={homeFeed.featuredProducts.slice(0, 4)}
      newArrivals={homeFeed.newArrivals.slice(0, 3)}
      totalProducts={catalog.total}
      averageRating={averageRating}
    />
  );
}

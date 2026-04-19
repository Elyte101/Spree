import type { Metadata } from "next";
import { FavoritesPage } from "@/components/favorites/favoritesPage";

export const metadata: Metadata = {
  title: "Favorites | Spree",
  description: "Review the products you’ve saved for later",
};

export default function FavoritesRoute() {
  return <FavoritesPage />;
}

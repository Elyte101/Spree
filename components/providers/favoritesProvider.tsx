'use client';

import * as React from "react";

import { useFavoritesStore } from "@/lib/stores/favoritesStore";

export function FavoritesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const markHydrated = useFavoritesStore((state) => state.markHydrated);

  React.useEffect(() => {
    markHydrated();
  }, [markHydrated]);

  return <>{children}</>;
}

export const useFavorites = () => {
  const favoriteIds = useFavoritesStore((state) => state.favoriteIds);
  const hasHydrated = useFavoritesStore((state) => state.hasHydrated);
  const isFavorite = useFavoritesStore((state) => state.isFavorite);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const clearFavorites = useFavoritesStore((state) => state.clearFavorites);

  return {
    favoriteIds,
    favoriteCount: favoriteIds.length,
    hasHydrated,
    isFavorite,
    toggleFavorite,
    clearFavorites,
  };
};

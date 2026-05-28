"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface FavoritesStoreState {
  favoriteIds: string[];
  hasHydrated: boolean;
  markHydrated: () => void;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => void;
  clearFavorites: () => void;
}

export const useFavoritesStore = create<FavoritesStoreState>()(
  persist(
    (set, get) => ({
      favoriteIds: [],
      hasHydrated: false,
      markHydrated: () => set({ hasHydrated: true }),
      isFavorite: (productId) => get().favoriteIds.includes(productId),
      toggleFavorite: (productId) =>
        set((state) => ({
          favoriteIds: state.favoriteIds.includes(productId)
            ? state.favoriteIds.filter((id) => id !== productId)
            : [...state.favoriteIds, productId],
        })),
      clearFavorites: () => set({ favoriteIds: [] }),
    }),
    {
      // localStorage safety: persists only an array of product ID strings.
      // No auth tokens, user IDs, addresses, or payment data are stored here.
      name: "spree-favorites",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ favoriteIds: state.favoriteIds }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    }
  )
);

"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface CatalogFiltersStoreState {
  search: string;
  sellerCountry: string;
  sellerRegion: string;
  inStockOnly: boolean;
  minPrice: number | undefined;
  maxPrice: number | undefined;
  setSearch: (value: string) => void;
  setSellerCountry: (value: string) => void;
  setSellerRegion: (value: string) => void;
  setInStockOnly: (value: boolean) => void;
  setMinPrice: (value: number | undefined) => void;
  setMaxPrice: (value: number | undefined) => void;
  reset: () => void;
}

const defaultFilters = {
  search: "",
  sellerCountry: "",
  sellerRegion: "",
  inStockOnly: false,
  minPrice: undefined as number | undefined,
  maxPrice: undefined as number | undefined,
};

export const useCatalogFiltersStore = create<CatalogFiltersStoreState>()(
  persist(
    (set) => ({
      ...defaultFilters,
      setSearch: (value) => set({ search: value }),
      // Changing country invalidates any region picked under the previous
      // country, so it's reset alongside — never leave a stale region from
      // a different country silently applied.
      setSellerCountry: (value) => set({ sellerCountry: value, sellerRegion: "" }),
      setSellerRegion: (value) => set({ sellerRegion: value }),
      setInStockOnly: (value) => set({ inStockOnly: value }),
      setMinPrice: (value) => set({ minPrice: value }),
      setMaxPrice: (value) => set({ maxPrice: value }),
      reset: () => set(defaultFilters),
    }),
    {
      // localStorage safety: persists only UI filter state (search text,
      // seller country/region, inStockOnly toggle). category/collection/
      // brand/sort/page are NOT persisted here — they live only in the URL
      // (?category=/?collection=/?brand=/?sort=/?page=), the single source
      // of truth the /products page reads from; keeping them out of this
      // store closes off an entire class of "chip shows one thing, applied
      // filter shows another" bugs where two independent state copies could
      // disagree (worse here, even, since this store is localStorage-
      // persisted — a stale ?page=/?sort= copy could survive across tabs
      // and sessions, not just re-renders).
      // No auth tokens, user IDs, addresses, or payment data are stored here.
      name: "spree-catalog-filters",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
      ),
    }
  )
);

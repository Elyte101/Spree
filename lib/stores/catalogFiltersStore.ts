"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { CatalogSort } from "@/types/types";

interface CatalogFiltersStoreState {
  search: string;
  category: string;
  brand: string;
  collection: string;
  sellerCountry: string;
  sellerRegion: string;
  sort: CatalogSort;
  page: number;
  inStockOnly: boolean;
  minPrice: number | undefined;
  maxPrice: number | undefined;
  setSearch: (value: string) => void;
  setCategory: (value: string) => void;
  setBrand: (value: string) => void;
  setCollection: (value: string) => void;
  setSellerCountry: (value: string) => void;
  setSellerRegion: (value: string) => void;
  setSort: (value: CatalogSort) => void;
  setPage: (value: number) => void;
  setInStockOnly: (value: boolean) => void;
  setMinPrice: (value: number | undefined) => void;
  setMaxPrice: (value: number | undefined) => void;
  reset: () => void;
}

const defaultFilters = {
  search: "",
  category: "",
  brand: "",
  collection: "",
  sellerCountry: "",
  sellerRegion: "",
  sort: "featured" as CatalogSort,
  page: 1,
  inStockOnly: false,
  minPrice: undefined as number | undefined,
  maxPrice: undefined as number | undefined,
};

export const useCatalogFiltersStore = create<CatalogFiltersStoreState>()(
  persist(
    (set) => ({
      ...defaultFilters,
      setSearch: (value) => set({ search: value, page: 1 }),
      setCategory: (value) => set({ category: value, page: 1 }),
      setBrand: (value) => set({ brand: value, page: 1 }),
      setCollection: (value) => set({ collection: value, page: 1 }),
      // Changing country invalidates any region picked under the previous
      // country, so it's reset alongside — never leave a stale region from
      // a different country silently applied.
      setSellerCountry: (value) => set({ sellerCountry: value, sellerRegion: "", page: 1 }),
      setSellerRegion: (value) => set({ sellerRegion: value, page: 1 }),
      setSort: (value) => set({ sort: value, page: 1 }),
      setPage: (value) => set({ page: value }),
      setInStockOnly: (value) => set({ inStockOnly: value, page: 1 }),
      setMinPrice: (value) => set({ minPrice: value, page: 1 }),
      setMaxPrice: (value) => set({ maxPrice: value, page: 1 }),
      reset: () => set(defaultFilters),
    }),
    {
      // localStorage safety: persists only UI filter/sort state (search text,
      // category, brand, collection, seller country/region, sort order, page,
      // inStockOnly toggle). No auth tokens, user IDs, addresses, or payment
      // data are stored here.
      name: "spree-catalog-filters",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
      ),
    }
  )
);

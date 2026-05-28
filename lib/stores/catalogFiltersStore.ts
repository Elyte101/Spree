"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { CatalogSort } from "@/types/types";

interface CatalogFiltersStoreState {
  search: string;
  category: string;
  brand: string;
  collection: string;
  sort: CatalogSort;
  page: number;
  inStockOnly: boolean;
  setSearch: (value: string) => void;
  setCategory: (value: string) => void;
  setBrand: (value: string) => void;
  setCollection: (value: string) => void;
  setSort: (value: CatalogSort) => void;
  setPage: (value: number) => void;
  setInStockOnly: (value: boolean) => void;
  reset: () => void;
}

const defaultFilters = {
  search: "",
  category: "",
  brand: "",
  collection: "",
  sort: "featured" as CatalogSort,
  page: 1,
  inStockOnly: false,
};

export const useCatalogFiltersStore = create<CatalogFiltersStoreState>()(
  persist(
    (set) => ({
      ...defaultFilters,
      setSearch: (value) => set({ search: value, page: 1 }),
      setCategory: (value) => set({ category: value, page: 1 }),
      setBrand: (value) => set({ brand: value, page: 1 }),
      setCollection: (value) => set({ collection: value, page: 1 }),
      setSort: (value) => set({ sort: value, page: 1 }),
      setPage: (value) => set({ page: value }),
      setInStockOnly: (value) => set({ inStockOnly: value, page: 1 }),
      reset: () => set(defaultFilters),
    }),
    {
      // localStorage safety: persists only UI filter/sort state (search text,
      // category, brand, collection, sort order, page, inStockOnly toggle).
      // No auth tokens, user IDs, addresses, or payment data are stored here.
      name: "spree-catalog-filters",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SettingsState {
  currency: string;
  region: string;
  defaultSort: string;
  layoutDensity: string;
  compactCards: boolean;
  marketingEmails: boolean;
  orderUpdates: boolean;
  restockAlerts: boolean;
  hasHydrated: boolean;
  setCurrency: (v: string) => void;
  setRegion: (v: string) => void;
  setDefaultSort: (v: string) => void;
  setLayoutDensity: (v: string) => void;
  setCompactCards: (v: boolean) => void;
  setMarketingEmails: (v: boolean) => void;
  setOrderUpdates: (v: boolean) => void;
  setRestockAlerts: (v: boolean) => void;
  markHydrated: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: "GH₵",
      region: "GH",
      defaultSort: "featured",
      layoutDensity: "comfortable",
      compactCards: false,
      marketingEmails: true,
      orderUpdates: true,
      restockAlerts: true,
      hasHydrated: false,
      setCurrency: (currency) => set({ currency }),
      setRegion: (region) => set({ region }),
      setDefaultSort: (defaultSort) => set({ defaultSort }),
      setLayoutDensity: (layoutDensity) => set({ layoutDensity }),
      setCompactCards: (compactCards) => set({ compactCards }),
      setMarketingEmails: (marketingEmails) => set({ marketingEmails }),
      setOrderUpdates: (orderUpdates) => set({ orderUpdates }),
      setRestockAlerts: (restockAlerts) => set({ restockAlerts }),
      markHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: "spree-settings",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
      ),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    }
  )
);

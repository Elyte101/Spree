'use client';

import * as React from "react";

import { useCartStore } from "@/lib/stores/cartStore";

// H4: server-side cart endpoint removed (it returned the first DB cart with no user scope).
// The cart now lives entirely in localStorage via Zustand persist — no server fetch needed.
export function CartProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export const useCart = () => {
  const cart = useCartStore((state) => state.cart);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const addToCart = useCartStore((state) => state.addToCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);

  return {
    cart,
    hasHydrated,
    itemCount: cart.itemCount,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
  };
};

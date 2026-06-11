'use client';

import * as React from "react";

import { useCartStore } from "@/lib/stores/cartStore";
import { CartSummary } from "@/types/types";

export function CartProvider({
  children,
  initialCart,
}: {
  children: React.ReactNode;
  initialCart: CartSummary;
}) {
  const initialize = useCartStore((state) => state.initialize);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { initialize(initialCart); }, []);

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

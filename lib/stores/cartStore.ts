"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { CartItem, CartSummary, Product } from "@/types/types";
import { calcProcessingFee } from "@/lib/pricing";

interface AddToCartOptions {
  color?: string | null;
  size?: string | null;
  quantity?: number;
  isPreorder?: boolean;
}

interface CartStoreState {
  cart: CartSummary;
  hasHydrated: boolean;
  initialize: (initialCart: CartSummary) => void;
  markHydrated: () => void;
  addToCart: (product: Product, options?: AddToCartOptions) => void;
  updateQuantity: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  refreshPrices: (priceMap: Record<string, number>) => void;
  /**
   * G20: Merge guest cart items into the authenticated user's cart.
   *
   * Called after login. Combines the persisted guest cart (in localStorage)
   * with `serverItems` (any items previously saved server-side for this user).
   * Items are deduped by productId + color + size; quantities are summed.
   */
  mergeGuestCart: (serverItems: CartItem[]) => void;
}

const DEFAULT_STANDARD_SHIPPING = 12;

const defaultCart: CartSummary = {
  id: "cart-guest",
  items: [],
  itemCount: 0,
  subtotal: 0,
  shipping: 0,
  standardShipping: DEFAULT_STANDARD_SHIPPING,
  tax: 0,
  total: 0,
  currency: "GHS",
};

const sanitizePart = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

const buildCartItemId = (
  productId: string,
  color?: string | null,
  size?: string | null,
  isPreorder?: boolean
) =>
  [
    "cart",
    productId,
    color ? sanitizePart(color) : "default",
    size ? sanitizePart(size) : "default",
    isPreorder ? "preorder" : "ready",
  ].join("-");

const normalizeCart = (cart: CartSummary, standardShipping: number): CartSummary => {
  const subtotal = Number(
    cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)
  );
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const shipping = cart.items.length === 0 ? 0 : standardShipping;
  const tax = cart.items.length === 0 ? 0 : calcProcessingFee(subtotal);
  const total = Number((subtotal + shipping + tax).toFixed(2));

  return {
    ...cart,
    itemCount,
    subtotal,
    shipping,
    standardShipping,
    tax,
    total,
  };
};

export const useCartStore = create<CartStoreState>()(
  persist(
    (set, get) => ({
      cart: defaultCart,
      hasHydrated: false,
      initialize: (initialCart) => {
        const standardShipping =
          initialCart.standardShipping ?? initialCart.shipping ?? DEFAULT_STANDARD_SHIPPING;

        set((state) => {
          const sourceCart = state.cart.items.length > 0 ? state.cart : initialCart;
          return {
            cart: normalizeCart(
              {
                ...initialCart,
                ...sourceCart,
                id: sourceCart.id || initialCart.id,
                currency: sourceCart.currency || initialCart.currency,
                items: sourceCart.items,
              },
              standardShipping
            ),
            hasHydrated: true,
          };
        });
      },
      markHydrated: () => set({ hasHydrated: true }),
      addToCart: (product, options = {}) => {
        const currentCart = get().cart;
        const standardShipping =
          currentCart.standardShipping ?? currentCart.shipping ?? DEFAULT_STANDARD_SHIPPING;
        const isPreorder = options.isPreorder ?? !product.inStock;

        if (!product.inStock && !isPreorder) {
          return;
        }

        const color = options.color ?? product.colors[0] ?? undefined;
        const size = options.size ?? product.sizes?.[0] ?? undefined;
        const quantity = Math.max(1, options.quantity ?? 1);
        const cartItemId = buildCartItemId(product.id, color, size, isPreorder);

        set((state) => {
          const existingItem = state.cart.items.find(
            (item) =>
              item.productId === product.id &&
              (item.color ?? undefined) === color &&
              (item.size ?? undefined) === size &&
              Boolean(item.isPreorder) === isPreorder
          );

          const nextItems = existingItem
            ? state.cart.items.map((item) =>
                item.id === existingItem.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              )
            : [
                ...state.cart.items,
                {
                  id: cartItemId,
                  productId: product.id,
                  name: product.name,
                  image: product.image,
                  price: parseFloat(String(product.price)),
                  quantity,
                  color,
                  size,
                  isPreorder,
                } satisfies CartItem,
              ];

          return {
            cart: normalizeCart(
              {
                ...state.cart,
                items: nextItems,
              },
              standardShipping
            ),
          };
        });
      },
      updateQuantity: (id, delta) => {
        const standardShipping =
          get().cart.standardShipping ?? get().cart.shipping ?? DEFAULT_STANDARD_SHIPPING;
        set((state) => ({
          cart: normalizeCart(
            {
              ...state.cart,
              items: state.cart.items.flatMap((item) => {
                if (item.id !== id) {
                  return [item];
                }

                const nextQuantity = item.quantity + delta;
                return nextQuantity <= 0 ? [] : [{ ...item, quantity: nextQuantity }];
              }),
            },
            standardShipping
          ),
        }));
      },
      removeItem: (id) => {
        const standardShipping =
          get().cart.standardShipping ?? get().cart.shipping ?? DEFAULT_STANDARD_SHIPPING;
        set((state) => ({
          cart: normalizeCart(
            {
              ...state.cart,
              items: state.cart.items.filter((item) => item.id !== id),
            },
            standardShipping
          ),
        }));
      },
      clearCart: () => {
        const currentCart = get().cart;
        const standardShipping =
          currentCart.standardShipping ?? currentCart.shipping ?? DEFAULT_STANDARD_SHIPPING;
        set({
          cart: normalizeCart(
            {
              ...currentCart,
              items: [],
            },
            standardShipping
          ),
        });
      },
      refreshPrices: (priceMap) => {
        const currentCart = get().cart;
        const standardShipping =
          currentCart.standardShipping ?? currentCart.shipping ?? DEFAULT_STANDARD_SHIPPING;
        const updatedItems = currentCart.items.map((item) =>
          item.productId && priceMap[item.productId] !== undefined
            ? { ...item, price: priceMap[item.productId] }
            : item
        );
        set({ cart: normalizeCart({ ...currentCart, items: updatedItems }, standardShipping) });
      },
      // G20: merge guest cart (localStorage) with server items on login
      mergeGuestCart: (serverItems) => {
        const currentCart = get().cart;
        const standardShipping =
          currentCart.standardShipping ?? currentCart.shipping ?? DEFAULT_STANDARD_SHIPPING;

        // Combine guest cart (localStorage) with server-side saved items.
        // Guest cart items take priority for price (they're fresher from the catalog).
        // Quantities are summed for matching items (same product + color + size).
        const mergedItems = [...currentCart.items];
        for (const serverItem of serverItems) {
          const existingIdx = mergedItems.findIndex(
            (item) =>
              item.productId === serverItem.productId &&
              (item.color ?? null) === (serverItem.color ?? null) &&
              (item.size ?? null) === (serverItem.size ?? null)
          );
          if (existingIdx >= 0) {
            mergedItems[existingIdx] = {
              ...mergedItems[existingIdx],
              quantity: mergedItems[existingIdx].quantity + serverItem.quantity,
            };
          } else {
            mergedItems.push(serverItem);
          }
        }

        set({
          cart: normalizeCart({ ...currentCart, items: mergedItems }, standardShipping),
        });
      },
    }),
    {
      // localStorage safety: persists only product IDs, names, images, prices,
      // quantities, and variant selections (color/size). No auth tokens, user IDs,
      // addresses, or payment data are stored here.
      // SSR guard: Next.js renders client components on the server too; returning a
      // no-op storage prevents the "storage currently unavailable" warning.
      name: "spree-cart",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }
      ),
      partialize: (state) => ({ cart: state.cart }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    }
  )
);

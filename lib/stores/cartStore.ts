"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { CartItem, CartSummary, Product } from "@/types/types";

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
  const tax = cart.items.length === 0 ? 0 : 2;
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
                  price: product.price,
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

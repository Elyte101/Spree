"use client";

import { useMemo } from "react";
import { useQuery } from "react-query";

import { api, ApiClientError, ProductQueryParams } from "@/lib/api";
import { CatalogResponse, NotificationItem, Product } from "@/types/types";

const ONE_MINUTE = 60_000;

export function useCatalogQuery(
  params: ProductQueryParams,
  initialData?: CatalogResponse
) {
  return useQuery<CatalogResponse, ApiClientError>(
    ["catalog", params],
    () => api.getProducts(params),
    {
      initialData,
      keepPreviousData: true,
      refetchOnWindowFocus: false,
      staleTime: ONE_MINUTE,
    }
  );
}

export function useFavoriteProductsQuery(
  favoriteIds: string[],
  enabled: boolean
) {
  return useQuery<CatalogResponse, ApiClientError>(
    ["favorites", favoriteIds],
    () =>
      api.getProducts({
        ids: favoriteIds,
        limit: favoriteIds.length,
        sort: "featured",
      }),
    {
      enabled: enabled && favoriteIds.length > 0,
      refetchOnWindowFocus: false,
      staleTime: ONE_MINUTE,
    }
  );
}

const NOTIFICATIONS_POLL_MS = 30_000;

export function useNotificationsQuery(initialData?: NotificationItem[]) {
  return useQuery<NotificationItem[], ApiClientError>(
    ["notifications"],
    api.getNotifications,
    {
      initialData,
      refetchOnWindowFocus: true,
      staleTime: ONE_MINUTE,
      refetchInterval: NOTIFICATIONS_POLL_MS,
    }
  );
}

/**
 * "You might also like" for the cart page: similar to what's actually in the
 * cart (via the same category/collection relation as product-page "related
 * products"), never the cart's own items. Seeds from a handful of distinct
 * cart products rather than every line item, to cap the number of requests.
 */
export function useCartRecommendationsQuery(
  cartProductIds: string[],
  initialData?: Product[]
) {
  const cartIdSet = useMemo(() => new Set(cartProductIds), [cartProductIds]);
  const seedIds = useMemo(() => cartProductIds.slice(0, 3), [cartProductIds]);

  const query = useQuery<Product[], ApiClientError>(
    ["cart-recommendations", seedIds],
    async () => {
      if (seedIds.length === 0) {
        const featured = await api.getProducts({ limit: 8, sort: "featured" });
        return featured.items;
      }

      const relatedLists = await Promise.all(
        seedIds.map((id) => api.getRelatedProducts(id, 6))
      );

      const seen = new Set<string>();
      const merged: Product[] = [];
      for (const list of relatedLists) {
        for (const product of list) {
          if (seen.has(product.id)) continue;
          seen.add(product.id);
          merged.push(product);
        }
      }
      return merged;
    },
    {
      refetchOnWindowFocus: false,
      staleTime: ONE_MINUTE,
    }
  );

  // Belt-and-suspenders: never show a product that's currently in the cart,
  // whether it slipped in via the SSR fallback or a "related" lookup.
  const products = useMemo(() => {
    const source = query.data ?? initialData ?? [];
    return source.filter((product) => !cartIdSet.has(product.id)).slice(0, 4);
  }, [query.data, initialData, cartIdSet]);

  return { ...query, products };
}

export function useFavoriteProducts(favoriteIds: string[], enabled: boolean) {
  const query = useFavoriteProductsQuery(favoriteIds, enabled);

  const orderedProducts = useMemo(() => {
    const items = query.data?.items ?? [];
    const order = new Map(favoriteIds.map((id, index) => [id, index]));
    return [...items].sort((left, right) => {
      const leftIndex = order.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = order.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    });
  }, [favoriteIds, query.data?.items]);

  return {
    ...query,
    orderedProducts,
  };
}

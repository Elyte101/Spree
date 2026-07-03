"use client";

import { useMemo } from "react";
import { useQuery } from "react-query";

import { api, ApiClientError, ProductQueryParams } from "@/lib/api";
import { CatalogResponse, NotificationItem } from "@/types/types";

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

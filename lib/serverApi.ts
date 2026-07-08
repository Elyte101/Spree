import "server-only";

import {
  AdminOverview,
  AdminSellerDetail,
  Brand,
  CatalogResponse,
  Category,
  Collection,
  HomeFeed,
  NotificationItem,
  Product,
  SellerDetail,
  SellerSummary,
  SearchResponse,
  TopProductsResponse,
  UserProfile,
} from "@/types/types";
import { buildQueryString } from "@/lib/api/queryString";
import { ProductQueryParams } from "@/lib/api/types";
import { getBackendApiBaseUrl, getBackendInternalApiKey } from "@/lib/runtimeConfig";

export const BACKEND_UNAVAILABLE_MESSAGE =
  "Some store details are unavailable right now, but you can still keep browsing.";

const reportedUnavailablePaths = new Set<string>();

const buildBackendUrl = (path: string) =>
  `${getBackendApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

const createFallbackHomeFeed = (): HomeFeed => ({
  hero: {
    id: "backend-unavailable",
    title: "Store will be available in a few minutes.",
    subtitle:
      "Some items are not loading right now, but you can still look around and come back in a moment.",
    ctaLabel: "Keep browsing",
    ctaHref: "/products",
    image: "/product-placeholder.svg",
  },
  featuredProducts: [],
  newArrivals: [],
  categories: [],
  collections: [],
  brands: [],
});

const createFallbackCatalog = (params?: ProductQueryParams): CatalogResponse => ({
  items: [],
  total: 0,
  page: params?.page ?? 1,
  limit: params?.limit ?? 12,
  totalPages: 0,
  sort: params?.sort ?? "featured",
  filters: {
    categories: [],
    brands: [],
    tags: [],
    collections: [],
    priceRange: {
      min: 0,
      max: 0,
    },
  },
});

const createFallbackSearchResponse = (query: string): SearchResponse => ({
  query,
  products: [],
  categories: [],
  brands: [],
  collections: [],
});

const createFallbackUserProfile = (
  userId: string,
  fallback?: Partial<Pick<UserProfile, "name" | "email" | "role">>
): UserProfile => ({
  id: userId,
  name: fallback?.name ?? "Spree User",
  email: fallback?.email ?? "",
  role: fallback?.role ?? "customer",
  phone: "",
  storeName: "",
  storeSlug: "",
  storeTagline: "",
  storeDescription: "",
  storeLocation: {
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  },
  sellerContact: {
    businessEmail: fallback?.email ?? "",
    businessPhone: "",
    whatsapp: "",
    registrationNumber: "",
  },
  sellerType: "retail",
  sellerStatus: fallback?.role === "vendor" || fallback?.role === "admin" ? "active" : "buyer",
  sellerBadge: "",
  completedDeliveries: 0,
  averageDeliveryDays: null,
  sellerNotice: "",
  adminNote: "",
  governmentIdType: "ghana-card",
  governmentIdNumber: "",
  governmentIdVerified: false,
  sellerStartedAt: null,
  sellerIdentity: {
    governmentIdType: "ghana-card",
    governmentIdNumber: "",
    storeTagline: "",
  },
  shippingAddress: {
    fullName: fallback?.name ?? "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  },
  paymentInfo: {
    method: "card",
    cardholderName: fallback?.name ?? "",
    cardLast4: "",
    expiryMonth: "",
    expiryYear: "",
    billingPostalCode: "",
  },
  payoutInfo: {},
  niaVerifiedAt: null,
  niaMatchConfidence: null,
});

const isConnectionError = (error: unknown) => {
  if (error instanceof BackendUnavailableError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const cause = (error as Error & { cause?: unknown }).cause;
  const causeCode =
    cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string"
      ? cause.code
      : "";
  const causeMessage =
    cause instanceof Error
      ? cause.message
      : typeof cause === "string"
        ? cause
        : "";
  const details = [error.message, causeCode, causeMessage].join(" ");

  // Also catch AbortError raised by AbortSignal.timeout()
  if (error.name === "AbortError" || error.name === "TimeoutError") {
    return true;
  }

  return /fetch failed|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|ETIMEDOUT|UND_ERR_CONNECT_TIMEOUT/i.test(
    details
  );
};

const reportBackendUnavailable = (path: string, error: unknown) => {
  const backendUrl = buildBackendUrl(path);

  if (reportedUnavailablePaths.has(backendUrl)) {
    return;
  }

  reportedUnavailablePaths.add(backendUrl);

  const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;
  const code =
    cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string"
      ? cause.code
      : error instanceof Error && "code" in error && typeof (error as Error & { code?: unknown }).code === "string"
        ? (error as Error & { code: string }).code
        : "UNKNOWN";
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown backend connection error";

  console.warn(
    JSON.stringify({ event: "upstream_unreachable", url: backendUrl, code, message })
  );
};

export class BackendUnavailableError extends Error {
  cause?: unknown;

  constructor(cause?: unknown) {
    super(BACKEND_UNAVAILABLE_MESSAGE);
    this.name = "BackendUnavailableError";
    this.cause = cause;
  }
}

export const isBackendUnavailableError = (
  error: unknown
): error is BackendUnavailableError => error instanceof BackendUnavailableError;

async function fetchBackend(
  path: string,
  init?: RequestInit,
  options?: { internal?: boolean }
) {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options?.internal) {
    try {
      headers.set("X-Internal-Api-Key", getBackendInternalApiKey());
    } catch (err) {
      throw new BackendUnavailableError(err);
    }
  }

  try {
    return await fetch(buildBackendUrl(path), {
      ...init,
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    if (isConnectionError(error)) {
      reportBackendUnavailable(path, error);
      throw new BackendUnavailableError(error);
    }

    throw error;
  }
}

async function getJson<T>(
  path: string,
  init?: RequestInit,
  options?: { internal?: boolean; fallback?: () => T }
): Promise<T> {
  try {
    const response = await fetchBackend(path, init, options);

    if (!response.ok) {
      // 5xx and auth errors (401/403) degrade gracefully when a fallback is provided.
      // Never let a single backend hiccup hard-500 the SSR page.
      if ((response.status >= 500 || response.status === 401 || response.status === 403) && options?.fallback) {
        console.warn(
          JSON.stringify({ event: "backend_error_fallback", url: buildBackendUrl(path), status: response.status })
        );
        return options.fallback();
      }
      throw new Error(`Backend request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (options?.fallback && isBackendUnavailableError(error)) {
      return options.fallback();
    }

    throw error;
  }
}

export async function proxyBackend(
  path: string,
  init?: RequestInit,
  options?: { internal?: boolean }
): Promise<Response> {
  try {
    const response = await fetchBackend(path, init, options);
    const body = await response.text();
    const proxyHeaders = new Headers();
    const contentType = response.headers.get("content-type");

    if (contentType) {
      proxyHeaders.set("Content-Type", contentType);
    }

    return new Response(body, {
      status: response.status,
      headers: proxyHeaders,
    });
  } catch (error) {
    if (isBackendUnavailableError(error)) {
      return Response.json(
        {
          detail: BACKEND_UNAVAILABLE_MESSAGE,
        },
        {
          status: 503,
        }
      );
    }

    throw error;
  }
}

export const getHomeFeed = () =>
  getJson<HomeFeed>("/home", undefined, { fallback: createFallbackHomeFeed });

export const getProducts = (params?: ProductQueryParams) => {
  const { includeBlacklisted, ...rest } = params ?? {};
  const useInternal = Boolean(includeBlacklisted);
  const queryParams = includeBlacklisted ? { ...rest, includeBlacklisted: true } : rest;
  return getJson<CatalogResponse>(
    `/products${buildQueryString(queryParams)}`,
    useInternal ? { headers: { "X-Actor-Role": "admin" } } : undefined,
    { internal: useInternal, fallback: () => createFallbackCatalog(params) }
  );
};

export const getProductByIdOrSlug = async (identifier: string) => {
  const response = await fetchBackend(`/products/${identifier}`);

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(`Backend request failed with status ${response.status}`);
  }

  return response.json() as Promise<Product>;
};

export const getRelatedProducts = (identifier: string, limit = 4) =>
  getJson<Product[]>(`/products/${identifier}/related${buildQueryString({ limit })}`, undefined, {
    fallback: () => [],
  });

export const getCategories = () =>
  getJson<Category[]>("/categories", undefined, { fallback: () => [] });

export const getBrands = () =>
  getJson<Brand[]>("/brands", undefined, { fallback: () => [] });

export const getCollections = () =>
  getJson<Collection[]>("/collections", undefined, { fallback: () => [] });

export const getNotifications = (userId?: string) =>
  getJson<NotificationItem[]>(
    "/notifications",
    userId ? { headers: { "X-Actor-User-Id": userId } } : undefined,
    { internal: true, fallback: () => [] }
  );

export const getAdminOverview = () =>
  getJson<AdminOverview | null>(
    "/admin/overview",
    { headers: { "X-Actor-Role": "admin" } },
    { internal: true, fallback: () => null }
  );

export const getSellers = () =>
  getJson<SellerSummary[]>("/sellers", undefined, { fallback: () => [] });

export const getSeller = async (identifier: string) => {
  const response = await fetchBackend(`/sellers/${identifier}`);

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(`Backend request failed with status ${response.status}`);
  }

  return response.json() as Promise<SellerDetail>;
};

export const getAdminSellers = (filter?: "all" | "blacklisted" | "inactive") =>
  getJson<SellerSummary[]>(
    `/admin/sellers${buildQueryString(filter && filter !== "all" ? { filter } : {})}`,
    { headers: { "X-Actor-Role": "admin" } },
    { internal: true, fallback: () => [] }
  );

export const getAdminSeller = async (identifier: string) => {
  const response = await fetchBackend(
    `/admin/sellers/${identifier}`,
    { headers: { "X-Actor-Role": "admin" } },
    { internal: true }
  );

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(`Backend request failed with status ${response.status}`);
  }

  return response.json() as Promise<AdminSellerDetail>;
};

export const getAdminTopProducts = (page = 1, limit = 100) =>
  getJson<TopProductsResponse>(
    `/admin/products/top${buildQueryString({ page, limit })}`,
    { headers: { "X-Actor-Role": "admin" } },
    {
      internal: true,
      fallback: () => ({
        items: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      }),
    }
  );

export const searchStorefront = (query: string) =>
  getJson<SearchResponse>(`/search${buildQueryString({ query })}`, undefined, {
    fallback: () => createFallbackSearchResponse(query),
  });

export const getUserProfile = (
  userId: string,
  fallback?: Partial<Pick<UserProfile, "name" | "email" | "role">>,
  actorRole?: string
) =>
  getJson<UserProfile>(
    `/auth/profile/${userId}`,
    {
      headers: {
        "X-Actor-User-Id": userId,
        ...(actorRole ? { "X-Actor-Role": actorRole } : {}),
      },
    },
    {
      internal: true,
      fallback: () => createFallbackUserProfile(userId, fallback),
    }
  );

export const getOrders = (userId: string, role: string) =>
  getJson<import("@/types/types").OrderListItem[]>(
    "/orders",
    { headers: { "X-Actor-User-Id": userId, "X-Actor-Role": role } },
    { internal: true, fallback: () => [] }
  );

export const getOrder = async (
  orderId: string,
  userId: string,
  role: string
): Promise<import("@/types/types").OrderDetail | undefined> => {
  const response = await fetchBackend(`/orders/${orderId}`, {
    headers: { "X-Actor-User-Id": userId, "X-Actor-Role": role },
  }, { internal: true });
  if (response.status === 404 || response.status === 403) return undefined;
  if (!response.ok) throw new Error(`Backend request failed with status ${response.status}`);
  return response.json() as Promise<import("@/types/types").OrderDetail>;
};

export const getSellerOrders = (sellerId: string) =>
  getJson<import("@/types/types").OrderListItem[]>(
    "/vendor/orders",
    { headers: { "X-Actor-User-Id": sellerId } },
    { internal: true, fallback: () => [] }
  );

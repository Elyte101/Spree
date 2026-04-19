import "server-only";

import {
  AdminOverview,
  Brand,
  CartSummary,
  CatalogResponse,
  Category,
  Collection,
  HomeFeed,
  NotificationItem,
  Product,
  SearchResponse,
  UserProfile,
} from "@/types/types";
import { buildQueryString } from "@/lib/api/queryString";
import { ProductQueryParams } from "@/lib/api/types";

const DEFAULT_BACKEND_API_URL = "http://127.0.0.1:8000/api/v1";
const DEFAULT_BACKEND_INTERNAL_API_KEY = "spree-internal-dev-key";
const DEFAULT_STANDARD_SHIPPING = 12;

export const BACKEND_UNAVAILABLE_MESSAGE =
  "Some store details are unavailable right now, but you can still keep browsing.";
export const BACKEND_UNAVAILABLE_CART_ID = "cart-backend-unavailable";

const reportedUnavailablePaths = new Set<string>();

const getBackendBaseUrl = () =>
  (process.env.BACKEND_API_URL ?? DEFAULT_BACKEND_API_URL).replace(/\/$/, "");

const getBackendInternalApiKey = () =>
  process.env.BACKEND_INTERNAL_API_KEY ?? DEFAULT_BACKEND_INTERNAL_API_KEY;

const buildBackendUrl = (path: string) =>
  `${getBackendBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

const createFallbackHomeFeed = (): HomeFeed => ({
  hero: {
    id: "backend-unavailable",
    title: "The shop is taking a short pause.",
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

const createFallbackCart = (): CartSummary => ({
  id: BACKEND_UNAVAILABLE_CART_ID,
  items: [],
  itemCount: 0,
  subtotal: 0,
  shipping: 0,
  standardShipping: DEFAULT_STANDARD_SHIPPING,
  tax: 0,
  total: 0,
  currency: "USD",
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
  storeDescription: "",
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
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown backend connection error";

  console.warn(`[serverApi] Backend unavailable for ${backendUrl}: ${detail}`);
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

export const isBackendUnavailableCart = (cart: CartSummary) =>
  cart.id === BACKEND_UNAVAILABLE_CART_ID;

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
    headers.set("X-Internal-Api-Key", getBackendInternalApiKey());
  }

  try {
    return await fetch(buildBackendUrl(path), {
      ...init,
      headers,
      cache: "no-store",
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

export const getProducts = (params?: ProductQueryParams) =>
  getJson<CatalogResponse>(`/products${buildQueryString(params ?? {})}`, undefined, {
    fallback: () => createFallbackCatalog(params),
  });

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

export const getCart = () =>
  getJson<CartSummary>("/cart", undefined, { fallback: createFallbackCart });

export const getNotifications = () =>
  getJson<NotificationItem[]>("/notifications", undefined, { fallback: () => [] });

export const getAdminOverview = () =>
  getJson<AdminOverview | null>("/admin/overview", undefined, {
    internal: true,
    fallback: () => null,
  });

export const searchStorefront = (query: string) =>
  getJson<SearchResponse>(`/search${buildQueryString({ query })}`, undefined, {
    fallback: () => createFallbackSearchResponse(query),
  });

export const getUserProfile = (
  userId: string,
  fallback?: Partial<Pick<UserProfile, "name" | "email" | "role">>
) =>
  getJson<UserProfile>(`/auth/profile/${userId}`, undefined, {
    internal: true,
    fallback: () => createFallbackUserProfile(userId, fallback),
  });

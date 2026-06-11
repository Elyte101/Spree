import {
  AdminOverview,
  AdminSellerDetail,
  AuthUser,
  Brand,
  CartSummary,
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
import {
  CreateProductPayload,
  ProductQueryParams,
  ReportSellerPayload,
  SignUpPayload,
  UpdateProductPayload,
  UpdateSellerStatusPayload,
  UpdateProfilePayload,
} from "@/lib/api/types";

export type {
  CreateProductPayload,
  ProductQueryParams,
  ProductVariantPayload,
  ReportSellerPayload,
  SignUpPayload,
  UpdateProductPayload,
  UpdateSellerStatusPayload,
  UpdateProfilePayload,
} from "@/lib/api/types";

/* =========================
   Error Handling
========================= */

export class ApiClientError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    return payload?.detail || payload?.message || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

/* =========================
   Core Request Layer
========================= */

type RequestOptions<T> = {
  safe?: boolean;
  fallback?: T;
};

async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: RequestOptions<T>
): Promise<T> {
  const headers = new Headers(init?.headers);

  headers.set("Accept", "application/json");

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(input, {
      ...init,
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      if (options?.safe) {
        return options.fallback as T;
      }
      throw new ApiClientError(response.status, await parseError(response));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  } catch (error) {
    if (options?.safe) {
      return options.fallback as T;
    }
    throw error;
  }
}

/* =========================
   API METHODS
========================= */

export const api = {
  /* ---------- CORE ---------- */

  getHomeFeed: () =>
    requestJson<HomeFeed>("/api/home"),

  getProducts: (params?: ProductQueryParams) =>
    requestJson<CatalogResponse>(
      `/api/products${buildQueryString(params ?? {})}`
    ),

  getProduct: (id: string) =>
    requestJson<Product>(`/api/products/${id}`),

  getRelatedProducts: (id: string, limit = 4) =>
    requestJson<Product[]>(
      `/api/products/${id}/related${buildQueryString({ limit })}`
    ),

  /* ---------- CATALOG ---------- */

  getCategories: () =>
    requestJson<Category[]>("/api/categories"),

  getBrands: () =>
    requestJson<Brand[]>("/api/brands"),

  getCollections: () =>
    requestJson<Collection[]>("/api/collections"),

  /* ---------- USER ---------- */

  getProfile: () =>
    requestJson<UserProfile>("/api/profile"),

  updateProfile: (payload: UpdateProfilePayload) =>
    requestJson<UserProfile>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  signUp: (payload: SignUpPayload) =>
    requestJson<AuthUser>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /* ---------- CART ---------- */

  getCart: () =>
    requestJson<CartSummary>("/api/cart", {}, {
      safe: true,
      fallback: { items: [], total: 0 } as unknown as CartSummary,
    }),

  /* ---------- NON-CRITICAL (SAFE) ---------- */

  getNotifications: () =>
    requestJson<NotificationItem[]>("/api/notifications", {}, {
      safe: true,
      fallback: [],
    }),

  /* ---------- SELLERS ---------- */

  getSellers: () =>
    requestJson<SellerSummary[]>("/api/sellers"),

  getSeller: (id: string) =>
    requestJson<SellerDetail>(`/api/sellers/${id}`),

  followSeller: (id: string) =>
    requestJson<SellerSummary>(`/api/sellers/${id}/follow`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  reportSeller: (id: string, payload: ReportSellerPayload) =>
    requestJson<SellerSummary>(`/api/sellers/${id}/report`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /* ---------- ADMIN ---------- */

  getAdminOverview: () =>
    requestJson<AdminOverview>("/api/admin/overview"),

  getAdminSellers: (filter?: "all" | "blacklisted" | "inactive") =>
    requestJson<SellerSummary[]>(
      `/api/admin/sellers${buildQueryString(filter && filter !== "all" ? { filter } : {})}`
    ),

  getAdminSeller: (id: string) =>
    requestJson<AdminSellerDetail>(`/api/admin/sellers/${id}`),

  updateAdminSellerStatus: (id: string, payload: UpdateSellerStatusPayload) =>
    requestJson<AdminSellerDetail>(
      `/api/admin/sellers/${id}/status`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    ),

  deleteAdminSeller: (id: string) =>
    requestJson<void>(`/api/admin/sellers/${id}`, { method: "DELETE" }),

  blacklistAdminSeller: (id: string, blacklisted: boolean) =>
    requestJson<AdminSellerDetail>(`/api/admin/sellers/${id}/blacklist`, {
      method: "PATCH",
      body: JSON.stringify({ blacklisted }),
    }),

  getAdminTopProducts: (page = 1, limit = 100) =>
    requestJson<TopProductsResponse>(
      `/api/admin/products/top${buildQueryString({ page, limit })}`
    ),

  /* ---------- SEARCH ---------- */

  search: (query: string) =>
    requestJson<SearchResponse>(
      `/api/search${buildQueryString({ query })}`
    ),

  /* ---------- PRODUCTS ---------- */

  createProduct: (payload: CreateProductPayload) =>
    requestJson<Product>("/api/products", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateProduct: (id: string, payload: UpdateProductPayload) =>
    requestJson<Product>(`/api/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  deleteProduct: (id: string) =>
    requestJson<void>(`/api/products/${id}`, { method: "DELETE" }),

  blacklistProduct: (id: string, blacklisted: boolean) =>
    requestJson<Product>(`/api/products/${id}/blacklist`, {
      method: "PATCH",
      body: JSON.stringify({ blacklisted }),
    }),
};
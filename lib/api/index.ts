import {
  AdminOverview,
  AuthUser,
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
import {
  CreateProductPayload,
  ProductQueryParams,
  SignUpPayload,
  UpdateProfilePayload,
} from "@/lib/api/types";

export type {
  CreateProductPayload,
  ProductQueryParams,
  ProductVariantPayload,
  SignUpPayload,
  UpdateProfilePayload,
} from "@/lib/api/types";

export class ApiClientError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

async function parseError(response: Response) {
  try {
    const payload = (await response.json()) as { detail?: string; message?: string };
    return payload.detail ?? payload.message ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiClientError(response.status, await parseError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  getHomeFeed: () => requestJson<HomeFeed>("/api/home"),
  getProducts: (params?: ProductQueryParams) =>
    requestJson<CatalogResponse>(`/api/products${buildQueryString(params ?? {})}`),
  getProduct: (id: string) => requestJson<Product>(`/api/products/${id}`),
  getRelatedProducts: (id: string, limit = 4) =>
    requestJson<Product[]>(`/api/products/${id}/related${buildQueryString({ limit })}`),
  getCategories: () => requestJson<Category[]>("/api/categories"),
  getBrands: () => requestJson<Brand[]>("/api/brands"),
  getCollections: () => requestJson<Collection[]>("/api/collections"),
  getCart: () => requestJson<CartSummary>("/api/cart"),
  getNotifications: () => requestJson<NotificationItem[]>("/api/notifications"),
  getAdminOverview: () => requestJson<AdminOverview>("/api/admin/overview"),
  search: (query: string) =>
    requestJson<SearchResponse>(`/api/search${buildQueryString({ query })}`),
  signUp: (payload: SignUpPayload) =>
    requestJson<AuthUser>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getProfile: () => requestJson<UserProfile>("/api/profile"),
  updateProfile: (payload: UpdateProfilePayload) =>
    requestJson<UserProfile>("/api/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  createProduct: (payload: CreateProductPayload) =>
    requestJson<Product>("/api/products", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

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
  NotificationPrefMatrix,
  OnboardingState,
  Product,
  PushSubscriptionData,
  SellerDetail,
  SellerSummary,
  SearchResponse,
  TopProductsResponse,
  UserProfile,
  VerificationQueueItem,
} from "@/types/types";

import { buildQueryString } from "@/lib/api/queryString";
import {
  CreateProductPayload,
  ProductQueryParams,
  ReportSellerPayload,
  SellerRejectPayload,
  SignUpPayload,
  UpdateProductPayload,
  UpdateSellerStatusPayload,
  UpdateProfilePayload,
} from "@/lib/api/types";

export type {
  CreateProductPayload,
  OnboardingStep1Payload,
  OnboardingStep2Payload,
  OnboardingStep3Payload,
  OnboardingStep4Payload,
  OnboardingStep5Payload,
  ProductQueryParams,
  ProductVariantPayload,
  PushSubscribePayload,
  ReportSellerPayload,
  SellerRejectPayload,
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
  /** Full parsed JSON error body, when the response had one — lets callers
   * that need field-level detail (e.g. `{ errors: [{ path, code }] }`) read
   * past the flattened `message` string. Shape is endpoint-specific. */
  body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.body = body;
  }
}

async function parseError(response: Response): Promise<{ message: string; body: unknown }> {
  try {
    const payload = await response.json();
    // `detail` is sometimes a non-string (e.g. FastAPI's raw pydantic
    // validation error shape is a list of issue objects) — only trust it as
    // a display message when it's actually a string.
    const detail = typeof payload?.detail === "string" ? payload.detail : undefined;
    const message =
      typeof payload?.message === "string" ? payload.message : undefined;
    return {
      message: detail || message || `Request failed (${response.status})`,
      body: payload,
    };
  } catch {
    return { message: `Request failed (${response.status})`, body: undefined };
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
      const { message, body } = await parseError(response);
      throw new ApiClientError(response.status, message, body);
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

  requestPasswordReset: (email: string) =>
    requestJson<{ detail: string }>("/api/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  confirmPasswordReset: (token: string, password: string) =>
    requestJson<{ detail: string }>("/api/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),

  /* ---------- NON-CRITICAL (SAFE) ---------- */

  getNotifications: () =>
    requestJson<NotificationItem[]>("/api/notifications", {}, {
      safe: true,
      fallback: [],
    }),

  /* ---------- SELLERS ---------- */

  getSellers: () =>
    requestJson<SellerSummary[]>("/api/vendors"),

  getSeller: (id: string) =>
    requestJson<SellerDetail>(`/api/vendors/${id}`),

  followSeller: (id: string) =>
    requestJson<SellerSummary>(`/api/vendors/${id}/follow`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  reportSeller: (id: string, payload: ReportSellerPayload) =>
    requestJson<SellerSummary>(`/api/vendors/${id}/report`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /* ---------- ADMIN ---------- */

  getAdminOverview: () =>
    requestJson<AdminOverview>("/api/admin/overview"),

  getAdminSellers: (filter?: "all" | "blacklisted" | "inactive") =>
    requestJson<SellerSummary[]>(
      `/api/admin/vendors${buildQueryString(filter && filter !== "all" ? { filter } : {})}`
    ),

  getAdminSeller: (id: string) =>
    requestJson<AdminSellerDetail>(`/api/admin/vendors/${id}`),

  updateAdminSellerStatus: (id: string, payload: UpdateSellerStatusPayload) =>
    requestJson<AdminSellerDetail>(
      `/api/admin/vendors/${id}/status`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      }
    ),

  deleteAdminSeller: (id: string) =>
    requestJson<void>(`/api/admin/vendors/${id}`, { method: "DELETE" }),

  blacklistAdminSeller: (id: string, blacklisted: boolean) =>
    requestJson<AdminSellerDetail>(`/api/admin/vendors/${id}/blacklist`, {
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

  /* ---------- ONBOARDING ---------- */

  getOnboardingState: () =>
    requestJson<OnboardingState>("/api/vendor/onboarding"),

  saveOnboardingStep: (step: 1 | 2 | 3 | 4 | 5, payload: unknown) =>
    requestJson<UserProfile>(`/api/vendor/onboarding/step/${step}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  submitOnboarding: () =>
    requestJson<UserProfile>("/api/vendor/onboarding/submit", { method: "POST" }),

  getUploadUrl: (slot: "logo") =>
    requestJson<{ uploadUrl: string; path: string; bucket: string }>(
      "/api/vendor/onboarding/upload-url",
      { method: "POST", body: JSON.stringify({ slot }) }
    ),

  /* ---------- IDENTITY VERIFICATION (NIA + FACE MATCH) ---------- */

  lookupGhanaCard: (idNumber: string) =>
    requestJson<{ sessionId: string; fullName: string; dob: string; gender: string; mock: boolean }>(
      "/api/identity/lookup",
      { method: "POST", body: JSON.stringify({ idNumber }) }
    ),

  getSmileIdToken: () =>
    requestJson<{ partnerId: string; timestamp: string; signature: string; environment: string; mock: boolean }>(
      "/api/identity/smileid-token"
    ),

  faceVerify: (sessionId: string, images: { image_type_id: number; image: string }[]) =>
    requestJson<{ verified: boolean; confidence: number; message: string }>(
      "/api/identity/face-verify",
      { method: "POST", body: JSON.stringify({ sessionId, images }) }
    ),

  /* ---------- VERIFICATION QUEUE (ADMIN) ---------- */

  getVerificationQueue: () =>
    requestJson<VerificationQueueItem[]>("/api/admin/verification"),

  approveSeller: (id: string) =>
    requestJson<AdminSellerDetail>(`/api/admin/vendors/${id}/approve`, { method: "POST" }),

  rejectSeller: (id: string, payload: SellerRejectPayload) =>
    requestJson<AdminSellerDetail>(`/api/admin/vendors/${id}/reject`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  /* ---------- NOTIFICATIONS (EXTENDED) ---------- */

  getUnreadCount: () =>
    requestJson<{ count: number }>("/api/notifications/unread-count", {}, { safe: true, fallback: { count: 0 } }),

  markNotificationRead: (id: string) =>
    requestJson<void>(`/api/notifications/${id}/read`, { method: "PATCH" }),

  markAllNotificationsRead: () =>
    requestJson<void>("/api/notifications/read-all", { method: "POST" }),

  /* ---------- NOTIFICATION PREFERENCES ---------- */

  getNotificationPrefs: () =>
    requestJson<{ prefs: NotificationPrefMatrix }>("/api/auth/notification-preferences"),

  updateNotificationPrefs: (prefs: NotificationPrefMatrix) =>
    requestJson<{ prefs: NotificationPrefMatrix }>("/api/auth/notification-preferences", {
      method: "PATCH",
      body: JSON.stringify({ prefs }),
    }),

  /* ---------- PUSH SUBSCRIPTIONS ---------- */

  subscribePush: (payload: PushSubscriptionData) =>
    requestJson<{ status: string }>("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  unsubscribePush: (endpoint: string) =>
    requestJson<void>("/api/push/subscribe", {
      method: "DELETE",
      body: JSON.stringify({ endpoint }),
    }),

  /* ---------- ORDER ACTIONS (ADMIN) ---------- */

  refundOrder: (id: string) =>
    requestJson<{ id: string; status: string }>(`/api/orders/${id}/refund`, { method: "POST" }),

};
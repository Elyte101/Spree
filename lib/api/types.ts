import {
  CatalogSort,
  PaymentInfo,
  SellerContact,
  SellerStatus,
  SellerType,
  ShippingAddress,
  StoreLocation,
} from "@/types/types";

export interface ProductQueryParams {
  ids?: string[];
  category?: string;
  brand?: string;
  collection?: string;
  vendor?: string;
  tag?: string;
  search?: string;
  sort?: CatalogSort;
  page?: number;
  limit?: number;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  includeBlacklisted?: boolean;
}

export interface ProductVariantPayload {
  label: string;
  color?: string | null;
  size?: string | null;
  stock: number;
  image?: string | null;
}

export interface CreateProductPayload {
  slug?: string;
  name: string;
  description: string;
  price: number;
  discount: number;
  images: string[];
  categoryId?: string | null;
  categoryName?: string;
  brandId?: string | null;
  brandName?: string;
  collectionId?: string | null;
  collectionName?: string;
  stock: number;
  variants: ProductVariantPayload[];
  colors: string[];
  sizes: string[];
  badge?: string;
  tags: string[];
}

export interface SignUpPayload {
  name: string;
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  name: string;
  email: string;
  phone: string;
  shippingAddress: ShippingAddress;
  paymentInfo: PaymentInfo;
  isSeller?: boolean;
  storeName?: string;
  sellerType?: SellerType;
  storeTagline?: string;
  storeDescription?: string;
  storeLocation?: StoreLocation;
  sellerContact?: SellerContact;
  sellerIdentity?: {
    governmentIdType: "ghana-card" | "voters-id" | "drivers-license" | "passport" | "ecowas-card" | "ssnit";
    governmentIdNumber: string;
    storeTagline: string;
  };
}

export interface UpdateProductPayload {
  name?: string;
  description?: string;
  price?: number;
  discount?: number;
  images?: string[];
  categoryId?: string | null;
  categoryName?: string;
  brandId?: string | null;
  brandName?: string;
  collectionId?: string | null;
  collectionName?: string;
  stock?: number;
  badge?: string | null;
  tags?: string[];
}

export interface ReportSellerPayload {
  reason:
    | "counterfeit"
    | "fraud"
    | "abuse"
    | "delivery-issue"
    | "misleading-listing"
    | "other";
  details: string;
}

export interface UpdateSellerStatusPayload {
  status: Extract<SellerStatus, "pending" | "active" | "suspended" | "removed">;
  sellerNotice: string;
  adminNote: string;
  sellerBadge: string;
  completedDeliveries: number;
  averageDeliveryDays: number | null;
  governmentIdVerified: boolean;
}

// ── Onboarding step payloads ──────────────────────────────────────────────────

export interface OnboardingStep1Payload {
  name: string;
  phone: string;
  termsAccepted: boolean;
}

export interface OnboardingStep2Payload {
  country: string;
  state: string;
  city: string;
  addressLine1: string;
  postalCode?: string;
}

export interface OnboardingStep3Payload {
  storeName: string;
  storeDescription: string;
  storeTagline?: string;
  sellerType: SellerType;
  businessType: "individual" | "registered";
  registrationNumber?: string;
  logoUrl?: string;
}

export interface OnboardingStep4Payload {
  governmentIdType: "ghana-card" | "voters-id" | "drivers-license" | "passport" | "ecowas-card" | "ssnit";
  governmentIdNumber: string;
  idFrontUrl: string;
  idBackUrl: string;
  selfieUrl: string;
}

export interface OnboardingStep5Payload {
  method: "bank" | "mobile_money";
  bankName?: string;
  accountNumber?: string;
  bankCode?: string;
  mobileMoneyNetwork?: string;
  mobileMoneyNumber?: string;
  currency?: string;
  accountName: string;
}

export interface SellerRejectPayload {
  reason: string;
}

export interface PushSubscribePayload {
  endpoint: string;
  p256dh: string;
  auth: string;
}

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
  seller?: string;
  tag?: string;
  search?: string;
  sort?: CatalogSort;
  page?: number;
  limit?: number;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
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
  isSeller: boolean;
  storeName: string;
  sellerType: SellerType;
  storeTagline: string;
  storeDescription: string;
  storeLocation: StoreLocation;
  sellerContact: SellerContact;
  sellerIdentity: {
    governmentIdType: "ghana-card" | "voters-id" | "drivers-license" | "passport" | "ecowas-card" | "ssnit";
    governmentIdNumber: string;
    storeTagline: string;
  };
  shippingAddress: ShippingAddress;
  paymentInfo: PaymentInfo;
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

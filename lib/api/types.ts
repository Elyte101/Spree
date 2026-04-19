import { CatalogSort, PaymentInfo, ShippingAddress } from "@/types/types";

export interface ProductQueryParams {
  ids?: string[];
  category?: string;
  brand?: string;
  collection?: string;
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
  rating: number;
  reviewsCount: number;
  variants: ProductVariantPayload[];
  colors: string[];
  sizes: string[];
  badge?: string;
  tags: string[];
  createdAt?: string;
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
  storeDescription: string;
  shippingAddress: ShippingAddress;
  paymentInfo: PaymentInfo;
}

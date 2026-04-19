export type CatalogSort =
  | "featured"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "rating";

export type UserRole = "customer" | "seller" | "admin";
export type PaymentMethod = "card" | "paypal" | "bank-transfer";

export interface ProductVariant {
  id: string;
  sku: string;
  label: string;
  color?: string | null;
  size?: string | null;
  stock: number;
  image?: string | null;
}

export interface PriceRange {
  min: number;
  max: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  discount: number;
  images: string[];
  image: string;
  category: string;
  categoryId: string;
  categorySlug: string;
  brand: string;
  brandId: string;
  brandSlug: string;
  collection?: string | null;
  collectionId?: string | null;
  stock: number;
  rating: number;
  reviewsCount: number;
  reviewCount: number;
  variants: ProductVariant[];
  createdAt: string;
  originalPrice?: number | null;
  badge?: string;
  inStock: boolean;
  colors: string[];
  sizes: string[];
  tags: string[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  image: string;
  itemCount: number;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo: string;
  productCount: number;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  productCount: number;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  color?: string;
  size?: string;
  isPreorder?: boolean;
}

export interface CartSummary {
  id: string;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  shipping: number;
  standardShipping?: number;
  tax: number;
  total: number;
  currency: string;
}

export interface PromoBanner {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
}

export interface HomeFeed {
  hero: PromoBanner | null;
  featuredProducts: Product[];
  newArrivals: Product[];
  categories: Category[];
  collections: Collection[];
  brands: Brand[];
}

export interface CatalogFilters {
  categories: string[];
  brands: string[];
  tags: string[];
  collections: string[];
  priceRange: PriceRange;
}

export interface CatalogResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  sort: CatalogSort;
  filters: CatalogFilters;
}

export interface SearchResponse {
  query: string;
  products: Product[];
  categories: Category[];
  brands: Brand[];
  collections: Collection[];
}

export interface AdminProductSummary {
  id: string;
  slug: string;
  name: string;
  price: number;
  stock: number;
  createdAt: string;
}

export interface AdminOverview {
  productCount: number;
  categoryCount: number;
  brandCount: number;
  collectionCount: number;
  userCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  averageRating: number;
  recentProducts: AdminProductSummary[];
}

export type NotificationType = "promo" | "order" | "stock" | "account";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  type: NotificationType;
  href?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface PaymentInfo {
  method: PaymentMethod;
  cardholderName: string;
  cardLast4: string;
  expiryMonth: string;
  expiryYear: string;
  billingPostalCode: string;
}

export interface UserProfile extends AuthUser {
  phone: string;
  storeName: string;
  storeDescription: string;
  shippingAddress: ShippingAddress;
  paymentInfo: PaymentInfo;
}

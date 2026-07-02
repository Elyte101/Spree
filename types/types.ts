export type CatalogSort =
  | "featured"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "rating";

export type UserRole = "customer" | "vendor" | "admin";
// Spec: card OR MoMo only. NO bank transfer.
export type PaymentMethod = "card" | "mobile_money";
export type SellerStatus =
  | "buyer"
  | "incomplete"
  | "pending_verification"
  | "verified"
  | "rejected"
  | "active"
  | "pending"
  | "suspended"
  | "removed";
export type SellerType = "retail" | "wholesale";
// Spec: ONLY the Ghana Card is accepted for vendor identity verification.
export type GovernmentIdType = "ghana-card";

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

// Spec order state machine:
// pending → paid → processing → pre_transit → in_transit → delivered → confirmed → paid_out
// Backend uses "pending" for the initial payment-pending state.
// cancelled and refunded are terminal error states.
export type OrderStatus =
  | "pending"
  | "pending_payment"
  | "paid"
  | "processing"
  | "pre_transit"
  | "in_transit"
  | "delivered"
  | "confirmed"
  | "paid_out"
  | "cancelled"
  | "refunded";

export interface OrderListItem {
  id: string;
  status: OrderStatus;
  fullName: string;
  email: string;
  total: number;
  currency: string;
  itemCount: number;
  shippingMethod: string;
  trackingNumber?: string | null;
  createdAt: string;
}

export interface OrderDetailItem {
  id: string;
  productId?: string | null;
  sellerId?: string | null;
  name: string;
  image: string;
  price: number;
  quantity: number;
  color?: string | null;
  size?: string | null;
}

export interface OrderDetail {
  id: string;
  userId?: string | null;
  status: OrderStatus;
  fullName: string;
  email: string;
  phone?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  shippingMethod: string;
  paymentMethod: string;
  subtotal: number;
  shippingCost: number;
  tax: number;
  total: number;
  currency: string;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  paidAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  payoutAmount?: number | null;
  payoutReleasedAt?: string | null;
  paystackReference?: string | null;
  estimatedDeliveryDays?: number | null;
  estimatedDeliveryDate?: string | null;
  createdAt: string;
  items: OrderDetailItem[];
}

// Spec: payout is card OR MoMo (MTN/Telecel only). NO bank account fields.
export interface PayoutInfo {
  method: "card" | "mobile_money";
  mobileMoneyNetwork?: string;
  mobileMoneyNumber?: string;
  cardLast4?: string;
  cardholderName?: string;
  currency?: string;
  accountName?: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  sellerPrice?: number | null;
  discount: number;
  images: string[];
  image: string;
  category: string;
  categoryId: string;
  categorySlug: string;
  brand: string;
  brandId: string;
  brandSlug: string;
  sellerId?: string | null;
  sellerName?: string | null;
  storeName?: string | null;
  storeSlug?: string | null;
  sellerType?: SellerType | null;
  sellerBadge?: string | null;
  sellerLocation?: string | null;
  collection?: string | null;
  collectionId?: string | null;
  stock: number;
  rating: number;
  reviewsCount: number;
  purchaseCount: number;
  variants: ProductVariant[];
  createdAt: string;
  originalPrice?: number | null;
  badge?: string;
  inStock: boolean;
  isBlacklisted?: boolean;
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
  sellerCount: number;
  activeSellerCount: number;
  openSellerReportCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  averageRating: number;
  recentProducts: AdminProductSummary[];
}

export type NotificationType = "promo" | "order" | "stock" | "account";

export type NotificationEventType =
  // Vendor / seller lifecycle
  | "seller_created"
  | "docs_submitted"
  | "new_verification_pending"
  | "seller_approved"
  | "seller_rejected"
  | "payout_saved"
  | "onboarding_reminder"
  // Order events (buyer)
  | "order_placed"
  | "order_shipped"
  | "order_delivered"
  | "order_cancelled"
  | "order_refunded"
  | "order_payment_failed"
  // Order events (vendor)
  | "order_placed_seller"
  | "payout_released"
  | "payout_failed"
  // Stock alerts (vendor)
  | "low_stock"
  // Generic / legacy
  | "promo"
  | "order"
  | "stock"
  | "account";

export type NotificationChannel = "in_app" | "email" | "push";

export type OnboardingStepIndex = 0 | 1 | 2 | 3 | 4 | 5;

export interface OnboardingState {
  step: OnboardingStepIndex;
  profile: UserProfile;
}

export interface PushSubscriptionData {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type NotificationPrefMatrix = Partial<
  Record<NotificationEventType, Partial<Record<NotificationChannel, boolean>>>
>;

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  type: NotificationType;
  href?: string;
  eventType?: string | null;
  channel?: NotificationChannel;
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

export interface SellerIdentityInfo {
  governmentIdType: GovernmentIdType;
  governmentIdNumber: string;
  storeTagline: string;
}

export interface StoreLocation {
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface SellerContact {
  businessEmail: string;
  businessPhone: string;
  whatsapp: string;
  registrationNumber: string;
}

export interface PaymentInfo {
  method: PaymentMethod;
  // MoMo fields (present when method === "mobile_money")
  mobileMoneyNetwork?: string;
  mobileMoneyNumber?: string;
  accountName?: string;
  momoNameVerified?: boolean;
  // Card / bank fields
  cardholderName: string;
  cardLast4: string;
  expiryMonth: string;
  expiryYear: string;
  billingPostalCode: string;
}

export interface UserProfile extends AuthUser {
  phone: string;
  storeName: string;
  storeSlug: string;
  storeTagline: string;
  storeDescription: string;
  storeLocation: StoreLocation;
  sellerContact: SellerContact;
  sellerType: SellerType;
  sellerStatus: SellerStatus;
  sellerBadge: string;
  completedDeliveries: number;
  averageDeliveryDays?: number | null;
  sellerNotice: string;
  adminNote: string;
  governmentIdType: GovernmentIdType;
  governmentIdNumber: string;
  governmentIdVerified: boolean;
  sellerStartedAt?: string | null;
  sellerIdentity: SellerIdentityInfo;
  shippingAddress: ShippingAddress;
  paymentInfo: PaymentInfo;
  payoutInfo: Partial<PayoutInfo>;
  idFrontUrl: string;
  idBackUrl: string;
  selfieUrl: string;
}

export interface SellerSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  storeName: string;
  storeSlug: string;
  storeTagline: string;
  storeDescription: string;
  storeLocation: StoreLocation;
  sellerContact: SellerContact;
  sellerType: SellerType;
  sellerStatus: SellerStatus;
  sellerBadge: string;
  completedDeliveries: number;
  averageDeliveryDays?: number | null;
  sellerNotice: string;
  adminNote: string;
  governmentIdType: GovernmentIdType;
  governmentIdVerified: boolean;
  isBlacklisted?: boolean;
  lastLoginAt?: string | null;
  followerCount: number;
  productCount: number;
  purchaseCount: number;
  reportCount: number;
  startedAt?: string | null;
  createdAt: string;
}

export interface SellerReport {
  id: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
}

export interface SellerDetail extends SellerSummary {
  products: Product[];
}

export interface AdminSellerDetail extends SellerSummary {
  governmentIdNumber: string;
  idFrontUrl: string;
  idBackUrl: string;
  selfieUrl: string;
  onboardingStep: number;
  rejectionReason?: string | null;
  shippingAddress: ShippingAddress;
  paymentInfo: PaymentInfo;
  reports: SellerReport[];
}

export interface VerificationQueueItem extends SellerSummary {
  onboardingStep: number;
  rejectionReason?: string | null;
  adminNote: string;
}

export interface TopProductsResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

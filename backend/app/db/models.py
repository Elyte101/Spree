from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class PromoBanner(Base):
    __tablename__ = "promo_banners"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    subtitle: Mapped[str] = mapped_column(Text)
    cta_label: Mapped[str] = mapped_column(String(120))
    cta_href: Mapped[str] = mapped_column(String(255))
    image: Mapped[str] = mapped_column(String(255))


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    image: Mapped[str] = mapped_column(String(255))

    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Brand(Base):
    __tablename__ = "brands"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    logo: Mapped[str] = mapped_column(String(255))

    products: Mapped[list["Product"]] = relationship(back_populates="brand")


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text)
    image: Mapped[str] = mapped_column(String(255))

    products: Mapped[list["Product"]] = relationship(back_populates="collection")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str] = mapped_column(Text)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    discount_percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    images: Mapped[list[str]] = mapped_column(JSON, default=list)
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.id"), index=True)
    brand_id: Mapped[str] = mapped_column(ForeignKey("brands.id"), index=True)
    collection_id: Mapped[str | None] = mapped_column(
        ForeignKey("collections.id"),
        nullable=True,
        index=True,
    )
    seller_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    stock: Mapped[int] = mapped_column(Integer, default=0, index=True)
    rating: Mapped[float] = mapped_column(default=0)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0, index=True)
    purchase_count: Mapped[int] = mapped_column(Integer, default=0, index=True)
    variants: Mapped[list[dict]] = mapped_column(JSON, default=list)
    badge: Mapped[str | None] = mapped_column(String(120), nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_new_arrival: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_blacklisted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    brand: Mapped[Brand] = relationship(back_populates="products")
    category: Mapped[Category] = relationship(back_populates="products")
    collection: Mapped[Collection | None] = relationship(back_populates="products")
    vendor: Mapped["User | None"] = relationship(back_populates="products")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    recipient_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    type: Mapped[str] = mapped_column(String(32), index=True)
    href: Mapped[str | None] = mapped_column(String(255), nullable=True)
    event_type: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    channel: Mapped[str] = mapped_column(String(16), default="in_app", index=True)
    is_sent: Mapped[bool] = mapped_column(Boolean, default=True)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    endpoint: Mapped[str] = mapped_column(Text)
    p256dh: Mapped[str] = mapped_column(String(512))
    auth: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    role: Mapped[str] = mapped_column(String(32), default="customer")
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    store_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    store_slug: Mapped[str | None] = mapped_column(String(120), unique=True, nullable=True, index=True)
    store_tagline: Mapped[str | None] = mapped_column(String(160), nullable=True)
    store_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    store_location: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    seller_contact: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    seller_type: Mapped[str] = mapped_column(String(32), default="retail", index=True)
    seller_status: Mapped[str] = mapped_column(String(32), default="buyer", index=True)
    seller_badge: Mapped[str | None] = mapped_column(String(80), nullable=True)
    completed_deliveries: Mapped[int] = mapped_column(Integer, default=0)
    average_delivery_days: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    seller_notice: Mapped[str | None] = mapped_column(Text, nullable=True)
    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    government_id_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    government_id_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # HMAC-SHA256 of the normalised Ghana Card number — used to enforce one-card-per-account.
    # Never contains plaintext. Null until the user completes the NIA lookup step.
    government_id_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    government_id_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    seller_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    shipping_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    payment_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    payout_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    paystack_recipient_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    # A6/A10: bumped on password reset (and available for any future
    # "sign out everywhere" action). JWT sessions can't be revoked server-side,
    # so sensitive-action revalidation compares the token's issued-at time
    # against this to reject sessions minted before the last password change.
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_blacklisted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    oauth_provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    oauth_provider_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # NIA / Smile ID verification results (replaces id_front_url / id_back_url / selfie_url)
    nia_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    nia_match_confidence: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    verification_attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    onboarding_step: Mapped[int] = mapped_column(Integer, default=0)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    notification_prefs: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # G26: soft-delete — set deleted_at instead of hard-deleting rows.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    # G37: seller state-change timestamps.
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    products: Mapped[list[Product]] = relationship(back_populates="vendor")


class VerificationToken(Base):
    __tablename__ = "verification_tokens"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    token: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    # A6: "email_verification" (default, 24h expiry) or "password_reset" (1h
    # expiry) — kept in the same table but distinguished so a leaked/forged
    # email-verification token can't be replayed to reset a password.
    purpose: Mapped[str] = mapped_column(String(32), default="email_verification")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class SellerFollow(Base):
    __tablename__ = "seller_follows"
    __table_args__ = (
        UniqueConstraint("seller_id", "follower_id", name="uq_seller_follow"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    seller_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    follower_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )


class SellerReport(Base):
    __tablename__ = "seller_reports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    seller_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    reporter_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    reason: Mapped[str] = mapped_column(String(120))
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="open", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Cart(Base):
    __tablename__ = "carts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    currency: Mapped[str] = mapped_column(String(8), default="GHS")
    standard_shipping: Mapped[Decimal] = mapped_column(Numeric(10, 2))

    items: Mapped[list["CartItem"]] = relationship(
        back_populates="cart",
        cascade="all, delete-orphan",
    )


class CartItem(Base):
    __tablename__ = "cart_items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    cart_id: Mapped[str] = mapped_column(ForeignKey("carts.id"), index=True)
    product_id: Mapped[str | None] = mapped_column(ForeignKey("products.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255))
    image: Mapped[str] = mapped_column(String(255))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    quantity: Mapped[int] = mapped_column(Integer)
    color: Mapped[str | None] = mapped_column(String(120), nullable=True)
    size: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_preorder: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    cart: Mapped[Cart] = relationship(back_populates="items")
    product: Mapped[Product | None] = relationship()


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)

    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)

    address_line1: Mapped[str] = mapped_column(String(160))
    address_line2: Mapped[str | None] = mapped_column(String(160), nullable=True)
    city: Mapped[str] = mapped_column(String(120))
    state: Mapped[str] = mapped_column(String(120))
    postal_code: Mapped[str] = mapped_column(String(40))
    country: Mapped[str] = mapped_column(String(120))

    shipping_method: Mapped[str] = mapped_column(String(32), default="standard")
    payment_method: Mapped[str] = mapped_column(String(32), default="card")
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    shipping_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    tax: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    currency: Mapped[str] = mapped_column(String(8), default="GHS")

    tracking_number: Mapped[str | None] = mapped_column(String(120), nullable=True)
    tracking_carrier: Mapped[str | None] = mapped_column(String(80), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    shipped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payout_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    payout_released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # pending_account | processing | released | failed | reversed
    payout_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    paystack_reference: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True, index=True)
    paystack_tx_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    paystack_access_code: Mapped[str | None] = mapped_column(String(128), nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True, index=True)
    estimated_delivery_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimated_delivery_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
    )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), index=True)
    product_id: Mapped[str | None] = mapped_column(ForeignKey("products.id"), nullable=True)
    seller_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    image: Mapped[str] = mapped_column(String(255))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    quantity: Mapped[int] = mapped_column(Integer)
    color: Mapped[str | None] = mapped_column(String(120), nullable=True)
    size: Mapped[str | None] = mapped_column(String(64), nullable=True)
    commission_rate: Mapped[Decimal | None] = mapped_column(Numeric(12, 8), nullable=True)

    order: Mapped[Order] = relationship(back_populates="items")


# ── G6: Financial ledger ──────────────────────────────────────────────────────

class LedgerEntry(Base):
    """Immutable append-only record of every money movement in the platform.

    All amounts are stored in pesewas (integer) to avoid floating-point issues.
    """
    __tablename__ = "ledger_entries"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # Ledger entry type — see ledger.py for the canonical list.
    entry_type: Mapped[str] = mapped_column(String(64), index=True)
    # The order this relates to (nullable for platform-level entries).
    order_id: Mapped[str | None] = mapped_column(ForeignKey("orders.id"), nullable=True, index=True)
    # The seller receiving / disbursing funds (nullable for buyer-side entries).
    seller_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    # The buyer / payer (nullable for seller-side entries).
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    # Amount in pesewas (GHS × 100).
    amount_pesewas: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(8), default="GHS")
    # External reference (Paystack txn/transfer ID, etc.)
    reference: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True, index=True)
    # Structured metadata (commission_rate, processing_fee_rate, etc.)
    meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )


# ── G27: Admin audit log ──────────────────────────────────────────────────────

class AuditLog(Base):
    """Append-only record of every admin action that mutates platform state."""
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # The admin (or system) that performed the action.
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    # Dot-namespaced action name, e.g. "seller.approve", "product.blacklist".
    action: Mapped[str] = mapped_column(String(120), index=True)
    # The target resource type and ID.
    target_type: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    target_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # Snapshot of what changed (before/after diffs, rejection reason, etc.)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )


# ── Identity verification audit log ──────────────────────────────────────────

class VerificationAuditLog(Base):
    """Append-only record of every identity verification attempt."""
    __tablename__ = "verification_audit_logs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    outcome: Mapped[str] = mapped_column(String(16))   # "pass" | "fail" | "error"
    confidence_score: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    attempt_number: Mapped[int] = mapped_column(Integer, default=1)
    liveness_passed: Mapped[bool] = mapped_column(Boolean, default=False)
    mock: Mapped[bool] = mapped_column(Boolean, default=False)
    error_code: Mapped[str | None] = mapped_column(String(64), nullable=True)


# ── G23: Admin-editable site settings ────────────────────────────────────────

class SiteSetting(Base):
    """Key/value store for admin-configurable site-wide settings.

    Keys include: main_tagline, commission_rate, processing_fee_rate,
    auto_release_days, etc.
    """
    __tablename__ = "site_settings"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    updated_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)


# ── G22: Product likes / favourites ──────────────────────────────────────────

class ProductLike(Base):
    """Records a buyer liking / favouriting a product."""
    __tablename__ = "product_likes"
    __table_args__ = (
        UniqueConstraint("product_id", "user_id", name="uq_product_like"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


# ── G21: Product comments / reviews ──────────────────────────────────────────

class Comment(Base):
    """Buyer comment / review on a product.

    Distinct from the star-rating aggregated on Product.rating —
    Comments hold the free-text review body.
    """
    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    body: Mapped[str] = mapped_column(Text)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1–5
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


# ── C4: DB-backed verification sessions & rate-limit events ──────────────────

class IdentitySession(Base):
    """Server-side identity verification session — survives Vercel cold starts.

    Replaces the in-memory VerificationSessionStore.  NIA photo (photo_b64)
    is stored here server-side; it is never included in any HTTP response.
    """
    __tablename__ = "identity_sessions"

    session_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    id_number: Mapped[str] = mapped_column(Text)       # encrypted Ghana Card number
    full_name: Mapped[str] = mapped_column(String(255))
    dob: Mapped[str] = mapped_column(String(32))
    gender: Mapped[str] = mapped_column(String(32))
    photo_b64: Mapped[str] = mapped_column(Text)       # NIA mugshot — never sent to browser
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class RateLimitEvent(Base):
    """Append-only log of rate-limited actions — replaces the in-memory bucket dict.

    Each row is one "call". Queries count rows within the sliding window.
    Old rows are pruned lazily after each check.
    """
    __tablename__ = "rate_limit_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    key: Mapped[str] = mapped_column(String(255), index=True)  # e.g. "nia_lookup:user-xyz"
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )


class WebAuthnCredential(Base):
    """A registered passkey (WebAuthn public-key credential) for a user.

    Registration is usernameless/discoverable (residentKey="required"), so
    authentication never needs an email up front — the browser's platform
    authenticator UI lets the user pick from credentials scoped to this RP,
    and the credential's stored `user_id` tells us who just signed in.
    """
    __tablename__ = "webauthn_credentials"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    # Base64url-encoded credential ID — what the authenticator/browser sends
    # back on every subsequent authentication to identify which key was used.
    credential_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    # Base64url-encoded COSE public key — used to verify the signed assertion.
    public_key: Mapped[str] = mapped_column(Text)
    sign_count: Mapped[int] = mapped_column(Integer, default=0)
    transports: Mapped[str | None] = mapped_column(String(255), nullable=True)  # comma-joined
    device_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class WebAuthnChallenge(Base):
    """Server-side WebAuthn ceremony challenge — DB-backed (not an in-memory
    dict) for the same reason as IdentitySession/RateLimitEvent: Vercel
    serverless invocations don't share process memory, so an in-memory
    challenge store would 404 the browser's follow-up /verify call as soon
    as it landed on a different invocation.

    `user_id` is set for registration (the user is already logged in) and
    unset for authentication (unknown until the assertion is verified).
    """
    __tablename__ = "webauthn_challenges"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    challenge: Mapped[str] = mapped_column(String(255))  # base64url
    purpose: Mapped[str] = mapped_column(String(32))  # "registration" | "authentication"
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

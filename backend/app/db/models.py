from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text
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
    stock: Mapped[int] = mapped_column(Integer, default=0, index=True)
    rating: Mapped[float] = mapped_column(default=0)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0, index=True)
    variants: Mapped[list[dict]] = mapped_column(JSON, default=list)
    badge: Mapped[str | None] = mapped_column(String(120), nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_new_arrival: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
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


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    type: Mapped[str] = mapped_column(String(32), index=True)
    href: Mapped[str | None] = mapped_column(String(255), nullable=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(512))
    role: Mapped[str] = mapped_column(String(32), default="customer")
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    store_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    store_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    shipping_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    payment_info: Mapped[dict | None] = mapped_column(JSON, nullable=True)
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


class Cart(Base):
    __tablename__ = "carts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
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

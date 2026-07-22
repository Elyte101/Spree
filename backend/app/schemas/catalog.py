from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

CatalogSort = Literal["featured", "newest", "price-asc", "price-desc", "rating"]


class ProductVariantIn(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    color: str | None = Field(default=None, max_length=120)
    size: str | None = Field(default=None, max_length=64)
    stock: int = Field(default=0, ge=0)
    image: str | None = Field(default=None, max_length=255)


class ProductVariantOut(ProductVariantIn):
    id: str
    sku: str


class ProductCreateIn(BaseModel):
    slug: str | None = Field(default=None, max_length=160)
    name: str = Field(min_length=2, max_length=255)
    description: str = Field(min_length=8)
    price: float = Field(gt=0, le=999_999)
    discount: float = Field(default=0, ge=0, le=90)
    images: list[str] = Field(min_length=1)
    categoryId: str | None = None
    categoryName: str | None = Field(default=None, max_length=120)
    brandId: str | None = None
    brandName: str | None = Field(default=None, max_length=120)
    collectionId: str | None = None
    collectionName: str | None = Field(default=None, max_length=120)
    stock: int = Field(default=0, ge=0)
    variants: list[ProductVariantIn] = Field(default_factory=list)
    colors: list[str] = Field(default_factory=list)
    sizes: list[str] = Field(default_factory=list)
    badge: str | None = Field(default=None, max_length=120)
    tags: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_relations(self) -> "ProductCreateIn":
        if not self.categoryId and not (self.categoryName or "").strip():
            raise ValueError("Either categoryId or categoryName is required")

        if not self.brandId and not (self.brandName or "").strip():
            raise ValueError("Either brandId or brandName is required")

        return self


class ProductUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = Field(default=None, min_length=8)
    price: float | None = Field(default=None, gt=0, le=999_999)
    discount: float | None = Field(default=None, ge=0, le=90)
    images: list[str] | None = None
    categoryId: str | None = None
    categoryName: str | None = Field(default=None, max_length=120)
    brandId: str | None = None
    brandName: str | None = Field(default=None, max_length=120)
    collectionId: str | None = None
    collectionName: str | None = Field(default=None, max_length=120)
    stock: int | None = Field(default=None, ge=0)
    badge: str | None = Field(default=None, max_length=120)
    tags: list[str] | None = None


class ProductBlacklistIn(BaseModel):
    blacklisted: bool


class ProductFeaturedIn(BaseModel):
    featured: bool


class ProductOut(BaseModel):
    id: str
    slug: str
    name: str
    description: str
    price: float
    sellerPrice: float | None = None
    discount: float
    images: list[str]
    image: str
    category: str
    categoryId: str
    categorySlug: str
    brand: str
    brandId: str
    brandSlug: str
    sellerId: str | None = None
    sellerName: str | None = None
    storeName: str | None = None
    storeSlug: str | None = None
    sellerType: Literal["retail", "wholesale"] | None = None
    sellerBadge: str | None = None
    sellerVerified: bool = False
    sellerLocation: str | None = None
    collection: str | None = None
    collectionId: str | None = None
    stock: int
    rating: float
    reviewsCount: int
    purchaseCount: int
    variants: list[ProductVariantOut]
    createdAt: datetime
    originalPrice: float | None = None
    badge: str | None = None
    inStock: bool
    colors: list[str]
    sizes: list[str]
    tags: list[str]
    isBlacklisted: bool = False


class CategoryOut(BaseModel):
    id: str
    name: str
    slug: str
    image: str
    itemCount: int
    parentId: str | None = None


class BrandOut(BaseModel):
    id: str
    name: str
    slug: str
    logo: str
    productCount: int


class CollectionOut(BaseModel):
    id: str
    name: str
    slug: str
    description: str
    image: str
    productCount: int


class SellerLocationOut(BaseModel):
    """A (country, region) pair with at least one active seller who has a
    product — powers the storefront's location filter so users never pick a
    region that would show zero results."""
    country: str
    region: str


class PromoBannerOut(BaseModel):
    id: str
    title: str
    subtitle: str
    ctaLabel: str
    ctaHref: str
    image: str


class PriceRangeOut(BaseModel):
    min: float
    max: float


class CatalogFiltersOut(BaseModel):
    categories: list[str]
    brands: list[str]
    tags: list[str]
    collections: list[str]
    priceRange: PriceRangeOut


class CatalogResponseOut(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    limit: int
    totalPages: int
    sort: CatalogSort
    filters: CatalogFiltersOut


class HomeFeedOut(BaseModel):
    hero: PromoBannerOut | None = None
    featuredProducts: list[ProductOut]
    newArrivals: list[ProductOut]
    categories: list[CategoryOut]
    collections: list[CollectionOut]
    brands: list[BrandOut]


class SearchResponseOut(BaseModel):
    query: str
    products: list[ProductOut]
    categories: list[CategoryOut]
    brands: list[BrandOut]
    collections: list[CollectionOut]


class AdminProductSummaryOut(BaseModel):
    id: str
    slug: str
    name: str
    price: float
    stock: int
    createdAt: datetime


class AdminOverviewOut(BaseModel):
    productCount: int
    categoryCount: int
    brandCount: int
    collectionCount: int
    userCount: int
    sellerCount: int
    activeSellerCount: int
    openSellerReportCount: int
    lowStockCount: int
    outOfStockCount: int
    averageRating: float
    recentProducts: list[AdminProductSummaryOut]

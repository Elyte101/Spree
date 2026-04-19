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
    price: float = Field(gt=0)
    discount: float = Field(default=0, ge=0, le=90)
    images: list[str] = Field(min_length=1)
    categoryId: str | None = None
    categoryName: str | None = Field(default=None, max_length=120)
    brandId: str | None = None
    brandName: str | None = Field(default=None, max_length=120)
    collectionId: str | None = None
    collectionName: str | None = Field(default=None, max_length=120)
    stock: int = Field(default=0, ge=0)
    rating: float = Field(default=0, ge=0, le=5)
    reviewsCount: int = Field(default=0, ge=0)
    variants: list[ProductVariantIn] = Field(default_factory=list)
    colors: list[str] = Field(default_factory=list)
    sizes: list[str] = Field(default_factory=list)
    badge: str | None = Field(default=None, max_length=120)
    tags: list[str] = Field(default_factory=list)
    createdAt: datetime | None = None

    @model_validator(mode="after")
    def validate_relations(self) -> "ProductCreateIn":
        if not self.categoryId and not (self.categoryName or "").strip():
            raise ValueError("Either categoryId or categoryName is required")

        if not self.brandId and not (self.brandName or "").strip():
            raise ValueError("Either brandId or brandName is required")

        return self


class ProductOut(BaseModel):
    id: str
    slug: str
    name: str
    description: str
    price: float
    discount: float
    images: list[str]
    image: str
    category: str
    categoryId: str
    categorySlug: str
    brand: str
    brandId: str
    brandSlug: str
    collection: str | None = None
    collectionId: str | None = None
    stock: int
    rating: float
    reviewsCount: int
    reviewCount: int
    variants: list[ProductVariantOut]
    createdAt: datetime
    originalPrice: float | None = None
    badge: str | None = None
    inStock: bool
    colors: list[str]
    sizes: list[str]
    tags: list[str]


class CategoryOut(BaseModel):
    id: str
    name: str
    slug: str
    image: str
    itemCount: int


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
    lowStockCount: int
    outOfStockCount: int
    averageRating: float
    recentProducts: list[AdminProductSummaryOut]

import re
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from math import ceil
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import String, cast, distinct, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Brand, Category, Collection, Product, PromoBanner, SellerReport, User
from app.schemas.catalog import ProductCreateIn, ProductUpdateIn


@dataclass(slots=True)
class ProductListParams:
    ids: list[str] | None = None
    seller: str | None = None
    category: str | None = None
    brand: str | None = None
    collection: str | None = None
    tag: str | None = None
    search: str | None = None
    sort: str = "featured"
    page: int = 1
    limit: int = 12
    in_stock: bool | None = None
    min_price: float | None = None
    max_price: float | None = None
    include_blacklisted: bool = False


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower().strip()).strip("-")
    return slug or "product"


def _normalize_tags(tags: list[str]) -> list[str]:
    normalized: list[str] = []
    for tag in tags:
        cleaned = _slugify(tag)
        if cleaned and cleaned not in normalized:
            normalized.append(cleaned)
    return normalized


def _quantize_money(value: Decimal) -> float:
    return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def _build_original_price(price: Decimal, discount: Decimal) -> float | None:
    if discount <= 0 or discount >= 100:
        return None

    divisor = Decimal("1") - (discount / Decimal("100"))
    if divisor <= 0:
        return None

    return _quantize_money(price / divisor)


def _extract_unique_values(variants: list[dict], key: str) -> list[str]:
    values: list[str] = []
    for variant in variants:
        value = variant.get(key)
        if value and value not in values:
            values.append(value)
    return values


def _seller_badge_label(seller: User | None) -> str | None:
    if seller is None:
        return None

    custom_badge = (seller.seller_badge or "").strip()
    if custom_badge:
        return custom_badge

    completed_deliveries = seller.completed_deliveries or 0
    average_delivery_days = (
        float(seller.average_delivery_days) if seller.average_delivery_days is not None else None
    )

    if average_delivery_days is not None and average_delivery_days <= 2 and completed_deliveries >= 5:
        return "Fast delivery"

    if seller.seller_status == "active" and seller.government_id_verified:
        return "Verified seller"

    return None


def _seller_location_label(seller: User | None) -> str | None:
    if seller is None:
        return None

    location = seller.store_location or {}
    parts = [
        str(location.get("city", "")).strip(),
        str(location.get("state", "")).strip(),
        str(location.get("country", "")).strip(),
    ]
    label = ", ".join(part for part in parts if part)
    return label or None


_SPREE_MARKUP = Decimal("1.10")


def _product_to_dict(product: Product) -> dict:
    images = product.images or ["/product-placeholder.svg"]
    variants = product.variants or []
    seller_price = Decimal(str(product.price))
    listed_price = (seller_price * _SPREE_MARKUP).quantize(Decimal("0.01"))
    discount = Decimal(str(product.discount_percentage))

    return {
        "id": product.id,
        "slug": product.slug,
        "name": product.name,
        "description": product.description,
        "price": float(listed_price),
        "sellerPrice": float(seller_price),
        "discount": float(discount),
        "images": images,
        "image": images[0],
        "category": product.category.name,
        "categoryId": product.category.id,
        "categorySlug": product.category.slug,
        "brand": product.brand.name,
        "brandId": product.brand.id,
        "brandSlug": product.brand.slug,
        "sellerId": product.seller.id if product.seller else None,
        "sellerName": product.seller.name if product.seller else None,
        "storeName": product.seller.store_name if product.seller else None,
        "storeSlug": product.seller.store_slug if product.seller else None,
        "sellerType": product.seller.seller_type if product.seller else None,
        "sellerBadge": _seller_badge_label(product.seller),
        "sellerLocation": _seller_location_label(product.seller),
        "collection": product.collection.slug if product.collection else None,
        "collectionId": product.collection.id if product.collection else None,
        "stock": product.stock,
        "rating": float(product.rating),
        "reviewsCount": product.reviews_count,
        "purchaseCount": product.purchase_count,
        "variants": variants,
        "createdAt": product.created_at,
        "originalPrice": _build_original_price(listed_price, discount),
        "badge": product.badge,
        "inStock": product.stock > 0,
        "colors": _extract_unique_values(variants, "color"),
        "sizes": _extract_unique_values(variants, "size"),
        "tags": product.tags or [],
        "isBlacklisted": bool(product.is_blacklisted),
    }


def _category_to_dict(category: Category, count: int) -> dict:
    return {
        "id": category.id,
        "name": category.name,
        "slug": category.slug,
        "image": category.image,
        "itemCount": count,
    }


def _brand_to_dict(brand: Brand, count: int) -> dict:
    return {
        "id": brand.id,
        "name": brand.name,
        "slug": brand.slug,
        "logo": brand.logo,
        "productCount": count,
    }


def _collection_to_dict(collection: Collection, count: int) -> dict:
    return {
        "id": collection.id,
        "name": collection.name,
        "slug": collection.slug,
        "description": collection.description,
        "image": collection.image,
        "productCount": count,
    }


def _base_product_query(include_inactive_sellers: bool = False, include_blacklisted: bool = False):
    statement = (
        select(Product)
        .join(Product.brand)
        .join(Product.category)
        .outerjoin(Product.collection)
        .outerjoin(Product.seller)
        .options(
            selectinload(Product.brand),
            selectinload(Product.category),
            selectinload(Product.collection),
            selectinload(Product.seller),
        )
    )

    if not include_inactive_sellers:
        statement = statement.where(
            or_(
                Product.seller_id.is_(None),
                User.role == "admin",
                User.seller_status == "active",
            )
        )

    if not include_blacklisted:
        statement = statement.where(Product.is_blacklisted == False)  # noqa: E712

    return statement


def _apply_product_filters(statement, params: ProductListParams):
    if params.ids:
        statement = statement.where(Product.id.in_(params.ids))

    if params.seller:
        normalized_seller = params.seller.strip().lower()
        statement = statement.where(
            or_(
                Product.seller_id == params.seller,
                User.store_slug == params.seller,
                func.lower(func.coalesce(User.store_name, "")) == normalized_seller,
                func.lower(User.name) == normalized_seller,
            )
        )

    if params.category:
        normalized_category = params.category.strip().lower()
        statement = statement.where(
            or_(
                Category.id == params.category,
                Category.slug == params.category,
                func.lower(Category.name) == normalized_category,
            )
        )

    if params.brand:
        normalized_brand = params.brand.strip().lower()
        statement = statement.where(
            or_(
                Brand.id == params.brand,
                Brand.slug == params.brand,
                func.lower(Brand.name) == normalized_brand,
            )
        )

    if params.collection:
        normalized_collection = params.collection.strip().lower()
        statement = statement.where(
            or_(
                Collection.id == params.collection,
                Collection.slug == params.collection,
                func.lower(Collection.name) == normalized_collection,
            )
        )

    if params.tag:
        # Cast JSON array to text and use LIKE to find the slugified tag value.
        # This works on both SQLite (JSON stored as text) and PostgreSQL.
        normalized_tag = _slugify(params.tag)
        statement = statement.where(
            cast(Product.tags, String).like(f'%"{normalized_tag}"%')
        )

    if params.search:
        query = f"%{params.search.strip().lower()}%"
        statement = statement.where(
            or_(
                func.lower(Product.name).like(query),
                func.lower(Product.description).like(query),
                func.lower(Brand.name).like(query),
                func.lower(Category.name).like(query),
                func.lower(func.coalesce(Collection.name, "")).like(query),
            )
        )

    if params.in_stock is not None:
        statement = statement.where(Product.stock > 0 if params.in_stock else Product.stock <= 0)

    if params.min_price is not None:
        statement = statement.where(Product.price >= params.min_price)

    if params.max_price is not None:
        statement = statement.where(Product.price <= params.max_price)

    return statement


def _sort_product_query(statement, sort: str):
    if sort == "price-asc":
        return statement.order_by(Product.price.asc(), Product.rating.desc())

    if sort == "price-desc":
        return statement.order_by(Product.price.desc(), Product.rating.desc())

    if sort == "rating":
        return statement.order_by(Product.rating.desc(), Product.reviews_count.desc(), Product.created_at.desc())

    if sort == "newest":
        return statement.order_by(Product.is_new_arrival.desc(), Product.created_at.desc(), Product.rating.desc())

    return statement.order_by(
        Product.is_featured.desc(),
        Product.rating.desc(),
        Product.reviews_count.desc(),
        Product.created_at.desc(),
    )


def _catalog_filters(db: Session) -> dict:
    price_row = db.execute(select(func.min(Product.price), func.max(Product.price))).one()
    tag_rows = db.scalars(select(Product.tags)).all()

    return {
        "categories": sorted(db.scalars(select(Category.name).order_by(Category.name.asc())).all()),
        "brands": sorted(db.scalars(select(Brand.name).order_by(Brand.name.asc())).all()),
        "tags": sorted({tag for tags in tag_rows for tag in (tags or [])}),
        "collections": sorted(db.scalars(select(Collection.slug).order_by(Collection.name.asc())).all()),
        "priceRange": {
            "min": float(price_row[0] or 0),
            "max": float(price_row[1] or 0),
        },
    }


def _build_variant_sku(product_slug: str, color: str | None, size: str | None) -> str:
    parts = [product_slug]
    if color:
        parts.append(_slugify(color))
    if size:
        parts.append(_slugify(size))
    return "-".join(parts).upper()


def _build_variants(
    product_slug: str,
    images: list[str],
    stock: int,
    payload_variants: list[dict],
    colors: list[str],
    sizes: list[str],
) -> list[dict]:
    if payload_variants:
        variants: list[dict] = []
        for index, variant in enumerate(payload_variants, start=1):
            variants.append(
                {
                    "id": f"{product_slug}-variant-{index}",
                    "sku": _build_variant_sku(product_slug, variant.get("color"), variant.get("size")),
                    "label": variant["label"],
                    "color": variant.get("color"),
                    "size": variant.get("size"),
                    "stock": int(variant.get("stock", 0)),
                    "image": variant.get("image") or images[0],
                }
            )
        return variants

    normalized_colors = colors or [None]
    normalized_sizes = sizes or [None]
    combinations = max(1, len(normalized_colors) * len(normalized_sizes))
    per_variant = stock // combinations if combinations else stock
    remainder = stock % combinations if combinations else 0
    variants: list[dict] = []
    sequence = 1

    for color in normalized_colors:
        for size in normalized_sizes:
            variant_stock = per_variant + (1 if sequence <= remainder else 0)
            label_parts = [part for part in [color, size] if part]
            variants.append(
                {
                    "id": f"{product_slug}-variant-{sequence}",
                    "sku": _build_variant_sku(product_slug, color, size),
                    "label": " / ".join(label_parts) if label_parts else "Default",
                    "color": color,
                    "size": size,
                    "stock": variant_stock,
                    "image": images[0],
                }
            )
            sequence += 1

    return variants


def _resolve_category(
    db: Session,
    category_id: str | None,
    category_name: str | None,
    default_image: str,
) -> Category:
    if category_id:
        category = db.get(Category, category_id)
        if category is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
        return category

    normalized_name = (category_name or "").strip()
    normalized_slug = _slugify(normalized_name)
    category = db.scalar(
        select(Category).where(
            or_(
                Category.slug == normalized_slug,
                func.lower(Category.name) == normalized_name.lower(),
            )
        )
    )
    if category is not None:
        return category

    category = Category(
        id=f"cat-{uuid4().hex[:12]}",
        name=normalized_name,
        slug=normalized_slug,
        image=default_image,
    )
    db.add(category)
    db.flush()
    return category


def _resolve_brand(
    db: Session,
    brand_id: str | None,
    brand_name: str | None,
    default_logo: str,
) -> Brand:
    if brand_id:
        brand = db.get(Brand, brand_id)
        if brand is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")
        return brand

    normalized_name = (brand_name or "").strip()
    normalized_slug = _slugify(normalized_name)
    brand = db.scalar(
        select(Brand).where(
            or_(
                Brand.slug == normalized_slug,
                func.lower(Brand.name) == normalized_name.lower(),
            )
        )
    )
    if brand is not None:
        return brand

    brand = Brand(
        id=f"brand-{uuid4().hex[:12]}",
        name=normalized_name,
        slug=normalized_slug,
        logo=default_logo,
    )
    db.add(brand)
    db.flush()
    return brand


def _resolve_collection(
    db: Session,
    collection_id: str | None,
    collection_name: str | None,
    default_description: str,
    default_image: str,
) -> Collection | None:
    if collection_id:
        collection = db.get(Collection, collection_id)
        if collection is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Collection not found")
        return collection

    normalized_name = (collection_name or "").strip()
    if not normalized_name:
        return None

    normalized_slug = _slugify(normalized_name)
    collection = db.scalar(
        select(Collection).where(
            or_(
                Collection.slug == normalized_slug,
                func.lower(Collection.name) == normalized_name.lower(),
            )
        )
    )
    if collection is not None:
        return collection

    collection = Collection(
        id=f"collection-{uuid4().hex[:12]}",
        name=normalized_name,
        slug=normalized_slug,
        description=default_description,
        image=default_image,
    )
    db.add(collection)
    db.flush()
    return collection


def _load_products(
    db: Session,
    params: ProductListParams,
    *,
    include_inactive_sellers: bool = False,
) -> list[Product]:
    """Return a flat list of products matching params (no pagination, no count)."""
    statement = _sort_product_query(
        _apply_product_filters(
            _base_product_query(include_inactive_sellers, params.include_blacklisted),
            params,
        ),
        params.sort,
    )
    return list(db.scalars(statement.limit(params.limit)).unique().all())


def get_home_feed(db: Session) -> dict:
    banner = db.scalar(select(PromoBanner).limit(1))

    featured_products = db.scalars(
        _sort_product_query(
            _base_product_query().where(Product.is_featured.is_(True)),
            "featured",
        ).limit(8)
    ).unique().all()
    new_arrivals = db.scalars(
        _sort_product_query(
            _base_product_query().where(Product.is_new_arrival.is_(True)),
            "newest",
        ).limit(6)
    ).unique().all()

    if not featured_products:
        featured_products = db.scalars(_sort_product_query(_base_product_query(), "featured").limit(8)).unique().all()

    if not new_arrivals:
        new_arrivals = db.scalars(_sort_product_query(_base_product_query(), "newest").limit(6)).unique().all()

    return {
        "hero": (
            {
                "id": banner.id,
                "title": banner.title,
                "subtitle": banner.subtitle,
                "ctaLabel": banner.cta_label,
                "ctaHref": banner.cta_href,
                "image": banner.image,
            }
            if banner
            else None
        ),
        "featuredProducts": [_product_to_dict(product) for product in featured_products],
        "newArrivals": [_product_to_dict(product) for product in new_arrivals],
        "categories": list_categories(db),
        "collections": list_collections(db),
        "brands": list_brands(db),
    }


def list_products(db: Session, params: ProductListParams) -> dict:
    page = max(params.page, 1)
    limit = max(params.limit, 1)
    offset = (page - 1) * limit

    filtered = _apply_product_filters(_base_product_query(include_blacklisted=params.include_blacklisted), params)
    sorted_filtered = _sort_product_query(filtered, params.sort)

    # Count via subquery to avoid double-counting from JOINs
    total = db.scalar(
        select(func.count(distinct(Product.id))).select_from(filtered.subquery())
    ) or 0

    total_pages = max(1, ceil(total / limit)) if total else 1
    products = list(
        db.scalars(sorted_filtered.offset(offset).limit(limit)).unique().all()
    )

    return {
        "items": [_product_to_dict(product) for product in products],
        "total": total,
        "page": page,
        "limit": limit,
        "totalPages": total_pages,
        "sort": params.sort,
        "filters": _catalog_filters(db),
    }


def get_product(db: Session, identifier: str) -> dict | None:
    product = db.scalar(
        _base_product_query().where(or_(Product.id == identifier, Product.slug == identifier))
    )
    return _product_to_dict(product) if product else None


def create_product(db: Session, payload: ProductCreateIn, actor_user_id: str | None) -> dict:
    actor = db.get(User, actor_user_id) if actor_user_id else None
    if actor is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A signed-in seller account is required to create products",
        )

    if actor.role != "admin" and actor.seller_status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your seller account is not active right now",
        )

    images = [image.strip() for image in payload.images if image.strip()]
    if not images:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one product image is required",
        )

    category = _resolve_category(db, payload.categoryId, payload.categoryName, images[0])
    brand = _resolve_brand(db, payload.brandId, payload.brandName, images[0])
    collection = _resolve_collection(
        db, payload.collectionId, payload.collectionName, payload.description.strip(), images[0]
    )

    product_slug = _slugify(payload.slug or payload.name)
    existing_product = db.scalar(select(Product).where(Product.slug == product_slug))
    if existing_product is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A product with that slug already exists",
        )

    normalized_tags = _normalize_tags(payload.tags)
    variants = _build_variants(
        product_slug,
        images,
        payload.stock,
        [variant.model_dump() for variant in payload.variants],
        payload.colors,
        payload.sizes,
    )
    stock = max(payload.stock, sum(variant["stock"] for variant in variants))

    product = Product(
        id=f"prod-{uuid4().hex[:12]}",
        slug=product_slug,
        name=payload.name.strip(),
        description=payload.description.strip(),
        price=Decimal(str(payload.price)),
        discount_percentage=Decimal(str(payload.discount)),
        images=images,
        category_id=category.id,
        brand_id=brand.id,
        collection_id=collection.id if collection else None,
        seller_id=actor.id,
        stock=stock,
        rating=0,
        reviews_count=0,
        purchase_count=0,
        variants=variants,
        badge=payload.badge,
        tags=normalized_tags,
        is_featured="featured" in normalized_tags,
        is_new_arrival="new" in normalized_tags or "new-arrival" in normalized_tags,
    )
    db.add(product)
    db.commit()

    created_product = db.scalar(
        _base_product_query(include_inactive_sellers=True).where(Product.id == product.id)
    )
    if created_product is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Product creation failed",
        )

    return _product_to_dict(created_product)


def get_related_products(db: Session, identifier: str, limit: int = 4) -> list[dict]:
    product = db.scalar(
        _base_product_query().where(or_(Product.id == identifier, Product.slug == identifier))
    )
    if product is None:
        return []

    related_products = db.scalars(
        _sort_product_query(
            _base_product_query().where(
                Product.id != product.id,
                or_(
                    Product.category_id == product.category_id,
                    Product.collection_id == product.collection_id,
                ),
            ),
            "featured",
        ).limit(limit)
    ).unique().all()

    return [_product_to_dict(candidate) for candidate in related_products]


def list_categories(db: Session) -> list[dict]:
    rows = db.execute(
        select(Category, func.count(Product.id))
        .outerjoin(Product, Product.category_id == Category.id)
        .group_by(Category.id)
        .order_by(Category.name.asc())
    ).all()
    return [_category_to_dict(category, count) for category, count in rows]


def list_brands(db: Session) -> list[dict]:
    rows = db.execute(
        select(Brand, func.count(Product.id))
        .outerjoin(Product, Product.brand_id == Brand.id)
        .group_by(Brand.id)
        .order_by(Brand.name.asc())
    ).all()
    return [_brand_to_dict(brand, count) for brand, count in rows]


def list_collections(db: Session) -> list[dict]:
    rows = db.execute(
        select(Collection, func.count(Product.id))
        .outerjoin(Product, Product.collection_id == Collection.id)
        .group_by(Collection.id)
        .order_by(Collection.name.asc())
    ).all()
    return [_collection_to_dict(collection, count) for collection, count in rows]


def search_storefront(db: Session, query: str) -> dict:
    trimmed_query = query.strip()

    if not trimmed_query:
        return {
            "query": "",
            "products": [],
            "categories": [],
            "brands": [],
            "collections": [],
        }

    products = list(
        db.scalars(
            _sort_product_query(
                _apply_product_filters(_base_product_query(), ProductListParams(search=trimmed_query)),
                "featured",
            ).limit(6)
        ).unique().all()
    )

    query_lower = trimmed_query.lower()
    query_like = f"%{query_lower}%"

    categories = db.execute(
        select(Category, func.count(Product.id))
        .outerjoin(Product, Product.category_id == Category.id)
        .where(func.lower(Category.name).like(query_like))
        .group_by(Category.id)
        .order_by(Category.name.asc())
        .limit(5)
    ).all()

    brands = db.execute(
        select(Brand, func.count(Product.id))
        .outerjoin(Product, Product.brand_id == Brand.id)
        .where(func.lower(Brand.name).like(query_like))
        .group_by(Brand.id)
        .order_by(Brand.name.asc())
        .limit(5)
    ).all()

    collections = db.execute(
        select(Collection, func.count(Product.id))
        .outerjoin(Product, Product.collection_id == Collection.id)
        .where(
            or_(
                func.lower(Collection.name).like(query_like),
                func.lower(Collection.description).like(query_like),
            )
        )
        .group_by(Collection.id)
        .order_by(Collection.name.asc())
        .limit(5)
    ).all()

    return {
        "query": trimmed_query,
        "products": [_product_to_dict(product) for product in products],
        "categories": [_category_to_dict(c, cnt) for c, cnt in categories],
        "brands": [_brand_to_dict(b, cnt) for b, cnt in brands],
        "collections": [_collection_to_dict(c, cnt) for c, cnt in collections],
    }


def get_admin_overview(db: Session) -> dict:
    recent_products = db.scalars(
        _sort_product_query(_base_product_query(), "newest").limit(5)
    ).unique().all()
    average_rating = db.scalar(select(func.avg(Product.rating))) or 0

    return {
        "productCount": db.scalar(select(func.count(Product.id))) or 0,
        "categoryCount": db.scalar(select(func.count(Category.id))) or 0,
        "brandCount": db.scalar(select(func.count(Brand.id))) or 0,
        "collectionCount": db.scalar(select(func.count(Collection.id))) or 0,
        "userCount": db.scalar(select(func.count(User.id))) or 0,
        "sellerCount": db.scalar(select(func.count(User.id)).where(User.role.in_(["seller", "admin"]))) or 0,
        "activeSellerCount": db.scalar(
            select(func.count(User.id)).where(
                User.role.in_(["seller", "admin"]),
                User.seller_status == "active",
            )
        ) or 0,
        "openSellerReportCount": db.scalar(
            select(func.count(SellerReport.id)).where(SellerReport.status == "open")
        ) or 0,
        "lowStockCount": db.scalar(select(func.count(Product.id)).where(Product.stock.between(1, 9))) or 0,
        "outOfStockCount": db.scalar(select(func.count(Product.id)).where(Product.stock <= 0)) or 0,
        "averageRating": round(float(average_rating), 2),
        "recentProducts": [
            {
                "id": product.id,
                "slug": product.slug,
                "name": product.name,
                "price": float(product.price),
                "stock": product.stock,
                "createdAt": product.created_at,
            }
            for product in recent_products
        ],
    }


def _resolve_product_for_actor(
    db: Session,
    product_id: str,
    actor_user_id: str | None,
    actor_role: str,
) -> Product:
    product = db.scalar(
        _base_product_query(include_inactive_sellers=True, include_blacklisted=True).where(
            or_(Product.id == product_id, Product.slug == product_id)
        )
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    if actor_role != "admin":
        if actor_user_id is None or product.seller_id != actor_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only modify your own products",
            )

    return product


def update_product(
    db: Session,
    product_id: str,
    payload: ProductUpdateIn,
    actor_user_id: str | None,
    actor_role: str,
) -> dict:
    product = _resolve_product_for_actor(db, product_id, actor_user_id, actor_role)

    if payload.name is not None:
        product.name = payload.name.strip()
    if payload.description is not None:
        product.description = payload.description.strip()
    if payload.price is not None:
        product.price = Decimal(str(payload.price))
    if payload.discount is not None:
        product.discount_percentage = Decimal(str(payload.discount))
    if payload.images is not None:
        images = [img.strip() for img in payload.images if img.strip()]
        if images:
            product.images = images
    if payload.stock is not None:
        product.stock = max(payload.stock, 0)
    if payload.badge is not None:
        product.badge = payload.badge.strip() or None
    if payload.tags is not None:
        normalized = _normalize_tags(payload.tags)
        product.tags = normalized
        product.is_featured = "featured" in normalized
        product.is_new_arrival = "new" in normalized or "new-arrival" in normalized
    if payload.categoryId is not None or payload.categoryName is not None:
        default_img = (product.images or ["/product-placeholder.svg"])[0]
        product.category = _resolve_category(db, payload.categoryId, payload.categoryName, default_img)
        product.category_id = product.category.id
    if payload.brandId is not None or payload.brandName is not None:
        default_img = (product.images or ["/product-placeholder.svg"])[0]
        product.brand = _resolve_brand(db, payload.brandId, payload.brandName, default_img)
        product.brand_id = product.brand.id
    if payload.collectionId is not None or payload.collectionName is not None:
        default_img = (product.images or ["/product-placeholder.svg"])[0]
        product.collection = _resolve_collection(
            db, payload.collectionId, payload.collectionName, product.description or "", default_img
        )
        product.collection_id = product.collection.id if product.collection else None

    db.add(product)
    db.commit()

    refreshed = db.scalar(
        _base_product_query(include_inactive_sellers=True, include_blacklisted=True).where(Product.id == product.id)
    )
    return _product_to_dict(refreshed)


def delete_product(
    db: Session,
    product_id: str,
    actor_user_id: str | None,
    actor_role: str,
) -> None:
    product = _resolve_product_for_actor(db, product_id, actor_user_id, actor_role)
    db.delete(product)
    db.commit()


def toggle_product_blacklist(db: Session, product_id: str, blacklisted: bool) -> dict:
    product = db.scalar(
        _base_product_query(include_inactive_sellers=True, include_blacklisted=True).where(
            or_(Product.id == product_id, Product.slug == product_id)
        )
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    product.is_blacklisted = blacklisted
    db.add(product)
    db.commit()

    refreshed = db.scalar(
        _base_product_query(include_inactive_sellers=True, include_blacklisted=True).where(Product.id == product.id)
    )
    return _product_to_dict(refreshed)

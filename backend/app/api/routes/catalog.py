from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.api.deps import ActorRole, ActorUserId, CommentRateLimit, DBSession, InternalAPIKey, OptionalInternalKey
from app.schemas.catalog import (
    AdminOverviewOut,
    BrandOut,
    CatalogResponseOut,
    CategoryOut,
    CollectionOut,
    HomeFeedOut,
    ProductBlacklistIn,
    ProductCreateIn,
    ProductFeaturedIn,
    ProductOut,
    ProductUpdateIn,
    SearchResponseOut,
)
from app.services.catalog import (
    ProductListParams,
    create_comment,
    create_product,
    delete_comment,
    delete_product,
    flag_comment,
    get_admin_overview,
    get_home_feed,
    get_product,
    get_product_likes,
    get_related_products,
    list_brands,
    list_categories,
    list_collections,
    list_comments,
    list_products,
    list_user_liked_products,
    search_storefront,
    toggle_product_blacklist,
    toggle_product_featured,
    toggle_product_like,
    update_product,
)


class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    rating: int | None = Field(default=None, ge=1, le=5)

router = APIRouter()


def _parse_csv(value: str | None) -> list[str] | None:
    if not value:
        return None

    items = [item.strip() for item in value.split(",") if item.strip()]
    return items or None


@router.get("/home", response_model=HomeFeedOut)
def home_feed(db: DBSession):
    return get_home_feed(db)


@router.get("/products", response_model=CatalogResponseOut)
def products(
    db: DBSession,
    is_internal: OptionalInternalKey,
    ids: str | None = Query(default=None),
    vendor: str | None = Query(default=None),
    category: str | None = Query(default=None),
    brand: str | None = Query(default=None),
    collection: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    search: str | None = Query(default=None),
    sort: str = Query(default="featured"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=12, ge=1, le=48),
    in_stock: bool | None = Query(default=None, alias="inStock"),
    min_price: float | None = Query(default=None, alias="minPrice"),
    max_price: float | None = Query(default=None, alias="maxPrice"),
    include_blacklisted: bool = Query(default=False, alias="includeBlacklisted"),
):
    return list_products(
        db,
        ProductListParams(
            ids=_parse_csv(ids),
            vendor=vendor,
            category=category,
            brand=brand,
            collection=collection,
            tag=tag,
            search=search,
            sort=sort,
            page=page,
            limit=limit,
            in_stock=in_stock,
            min_price=min_price,
            max_price=max_price,
            include_blacklisted=include_blacklisted and is_internal,
        ),
    )


@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def products_create(
    payload: ProductCreateIn,
    db: DBSession,
    _: InternalAPIKey,
    actor_user_id: ActorUserId,
):
    # A2: actor_user_id comes from the verified signed actor token (deps.py),
    # not a raw X-Actor-User-Id header — a raw header here would let anyone
    # with the internal key create products under any vendor's account.
    return create_product(db, payload, actor_user_id)


@router.get("/products/{identifier}", response_model=ProductOut)
def product_details(identifier: str, db: DBSession):
    product = get_product(db, identifier)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    return product


@router.put("/products/{product_id}", response_model=ProductOut)
def product_update(
    product_id: str,
    payload: ProductUpdateIn,
    db: DBSession,
    _: InternalAPIKey,
    actor_user_id: ActorUserId,
    actor_role: ActorRole,
):
    return update_product(db, product_id, payload, actor_user_id, actor_role)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def product_delete(
    product_id: str,
    db: DBSession,
    _: InternalAPIKey,
    actor_user_id: ActorUserId,
    actor_role: ActorRole,
):
    delete_product(db, product_id, actor_user_id, actor_role)


@router.patch("/products/{product_id}/blacklist", response_model=ProductOut)
def product_blacklist(
    product_id: str,
    payload: ProductBlacklistIn,
    db: DBSession,
    _: InternalAPIKey,
    actor_role: ActorRole,
):
    if actor_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return toggle_product_blacklist(db, product_id, payload.blacklisted)


@router.patch("/products/{product_id}/featured", response_model=ProductOut)
def product_featured(
    product_id: str,
    payload: ProductFeaturedIn,
    db: DBSession,
    _: InternalAPIKey,
    actor_role: ActorRole,
):
    """G28: Admin-only toggle for whether a product appears in the featured home feed."""
    if actor_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return toggle_product_featured(db, product_id, payload.featured)


@router.get("/products/{identifier}/related", response_model=list[ProductOut])
def related_products(
    identifier: str,
    db: DBSession,
    limit: int = Query(default=4, ge=1, le=12),
):
    return get_related_products(db, identifier, limit)


@router.get("/categories", response_model=list[CategoryOut])
def categories(db: DBSession):
    return list_categories(db)


@router.get("/brands", response_model=list[BrandOut])
def brands(db: DBSession):
    return list_brands(db)


@router.get("/collections", response_model=list[CollectionOut])
def collections(db: DBSession):
    return list_collections(db)


@router.get("/search", response_model=SearchResponseOut)
def search(db: DBSession, query: str = Query(default="")):
    return search_storefront(db, query)


@router.get("/admin/overview", response_model=AdminOverviewOut)
def admin_overview(db: DBSession, _: InternalAPIKey, actor_role: ActorRole):
    if actor_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return get_admin_overview(db)


# ── G21: Comments ─────────────────────────────────────────────────────────────

@router.get("/products/{product_id}/comments")
def get_comments(product_id: str, db: DBSession):
    """Return all non-flagged comments for a product."""
    return list_comments(db, product_id)


@router.post("/products/{product_id}/comments", status_code=status.HTTP_201_CREATED)
def post_comment(
    product_id: str,
    payload: CommentIn,
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
    _rl: CommentRateLimit,  # G31: rate limit 5 comments per 60s per user
):
    """G21: Authenticated buyers can post a comment/review on a product."""
    if not actor_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return create_comment(db, product_id, actor_id, payload.body, payload.rating)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_comment(
    comment_id: str,
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
    actor_role: ActorRole,
):
    """Owner or admin can delete a comment."""
    if not actor_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    delete_comment(db, comment_id, actor_id, actor_role)


@router.post("/admin/comments/{comment_id}/flag")
def admin_flag_comment(
    comment_id: str,
    db: DBSession,
    _: InternalAPIKey,
    actor_role: ActorRole,
):
    """Admin-only: flag a comment so it's hidden from public."""
    return flag_comment(db, comment_id, actor_role)


# ── G22: Product likes / favourites ──────────────────────────────────────────

@router.post("/products/{product_id}/like")
def like_product(
    product_id: str,
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
):
    """G22: Idempotent like/unlike toggle. Returns {liked, likeCount}."""
    if not actor_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return toggle_product_like(db, product_id, actor_id)


@router.get("/products/{product_id}/likes")
def product_likes(
    product_id: str,
    db: DBSession,
    actor_id: ActorUserId,
):
    """Return like count and whether the requesting user has liked the product."""
    return get_product_likes(db, product_id, actor_id)


@router.get("/users/me/likes")
def my_liked_products(
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
):
    """Return all products liked by the current user."""
    if not actor_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return list_user_liked_products(db, actor_id)

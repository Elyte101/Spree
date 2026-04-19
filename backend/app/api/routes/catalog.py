from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import DBSession, InternalAPIKey
from app.schemas.catalog import (
    AdminOverviewOut,
    BrandOut,
    CatalogResponseOut,
    CategoryOut,
    CollectionOut,
    HomeFeedOut,
    ProductCreateIn,
    ProductOut,
    SearchResponseOut,
)
from app.services.catalog import (
    ProductListParams,
    create_product,
    get_admin_overview,
    get_home_feed,
    get_product,
    get_related_products,
    list_brands,
    list_categories,
    list_collections,
    list_products,
    search_storefront,
)

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
    ids: str | None = Query(default=None),
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
):
    return list_products(
        db,
        ProductListParams(
            ids=_parse_csv(ids),
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
        ),
    )


@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def products_create(payload: ProductCreateIn, db: DBSession, _: InternalAPIKey):
    return create_product(db, payload)


@router.get("/products/{identifier}", response_model=ProductOut)
def product_details(identifier: str, db: DBSession):
    product = get_product(db, identifier)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")

    return product


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
def admin_overview(db: DBSession, _: InternalAPIKey):
    return get_admin_overview(db)

from fastapi import APIRouter, Query

from app.api.deps import DBSession, InternalAPIKey
from app.schemas.marketplace import (
    AdminSellerDetailOut,
    AdminSellerStatusUpdateRequest,
    AdminSellerSummaryOut,
    FollowSellerRequest,
    ReportSellerRequest,
    SellerDetailOut,
    SellerSummaryOut,
    TopProductsResponseOut,
    UnfollowSellerRequest,
)
from app.services.marketplace import (
    follow_seller,
    get_admin_seller_detail,
    get_seller_detail,
    list_admin_sellers,
    list_public_sellers,
    list_top_products,
    report_seller,
    unfollow_seller,
    update_admin_seller_status,
)

router = APIRouter()


@router.get("/sellers", response_model=list[SellerSummaryOut])
def sellers(db: DBSession):
    return list_public_sellers(db)


@router.get("/sellers/{identifier}", response_model=SellerDetailOut)
def seller_details(identifier: str, db: DBSession):
    return get_seller_detail(db, identifier)


@router.post("/sellers/{seller_id}/follow", response_model=SellerSummaryOut)
def seller_follow(seller_id: str, payload: FollowSellerRequest, db: DBSession, _: InternalAPIKey):
    return follow_seller(db, seller_id, payload.followerId)


@router.delete("/sellers/{seller_id}/follow", response_model=SellerSummaryOut)
def seller_unfollow(seller_id: str, payload: UnfollowSellerRequest, db: DBSession, _: InternalAPIKey):
    return unfollow_seller(db, seller_id, payload.followerId)


@router.post("/sellers/{seller_id}/report", response_model=SellerSummaryOut)
def seller_report(seller_id: str, payload: ReportSellerRequest, db: DBSession, _: InternalAPIKey):
    return report_seller(db, seller_id, payload.reporterId, payload.reason, payload.details)


@router.get("/admin/sellers", response_model=list[AdminSellerSummaryOut])
def admin_sellers(db: DBSession, _: InternalAPIKey):
    return list_admin_sellers(db)


@router.get("/admin/sellers/{seller_id}", response_model=AdminSellerDetailOut)
def admin_seller_detail(seller_id: str, db: DBSession, _: InternalAPIKey):
    return get_admin_seller_detail(db, seller_id)


@router.put("/admin/sellers/{seller_id}/status", response_model=AdminSellerDetailOut)
def admin_seller_status_update(
    seller_id: str,
    payload: AdminSellerStatusUpdateRequest,
    db: DBSession,
    _: InternalAPIKey,
):
    return update_admin_seller_status(
        db,
        seller_id,
        payload.status,
        payload.sellerNotice,
        payload.adminNote,
        payload.sellerBadge,
        payload.completedDeliveries,
        payload.averageDeliveryDays,
        payload.governmentIdVerified,
    )


@router.get("/admin/products/top", response_model=TopProductsResponseOut)
def admin_top_products(
    db: DBSession,
    _: InternalAPIKey,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=100),
):
    return list_top_products(db, page, limit)

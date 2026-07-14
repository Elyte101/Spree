from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.api.deps import ActorRole, ActorUserId, DBSession, InternalAPIKey
from app.db.models import SiteSetting
from app.schemas.marketplace import (
    AdminSellerDetailOut,
    AdminSellerStatusUpdateRequest,
    AdminSellerSummaryOut,
    SellerBlacklistIn,
    SellerRejectRequest,
    SellerSummaryOut,
    TopProductsResponseOut,
)
from app.services.marketplace import (
    approve_seller,
    delete_seller,
    get_admin_seller_detail,
    get_seller_summary,
    list_admin_sellers,
    list_top_products,
    list_verification_queue,
    reject_seller,
    toggle_seller_blacklist,
    update_admin_seller_status,
)

router = APIRouter()


@router.get("/sellers/{identifier}/summary", response_model=SellerSummaryOut)
def seller_summary(identifier: str, db: DBSession):
    return get_seller_summary(db, identifier)


@router.get("/admin/verification", response_model=list[AdminSellerSummaryOut])
def admin_verification_queue(db: DBSession, _: InternalAPIKey, actor_role: ActorRole):
    if actor_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return list_verification_queue(db)


@router.post("/admin/sellers/{seller_id}/approve", response_model=AdminSellerDetailOut)
def admin_seller_approve(
    seller_id: str, db: DBSession, _: InternalAPIKey, actor_role: ActorRole, actor_id: ActorUserId
):
    if actor_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return approve_seller(db, seller_id, actor_id or "")


@router.post("/admin/sellers/{seller_id}/reject", response_model=AdminSellerDetailOut)
def admin_seller_reject(
    seller_id: str,
    payload: SellerRejectRequest,
    db: DBSession,
    _: InternalAPIKey,
    actor_role: ActorRole,
    actor_id: ActorUserId,
):
    if actor_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return reject_seller(db, seller_id, actor_id or "", payload.reason)


@router.get("/admin/sellers", response_model=list[AdminSellerSummaryOut])
def admin_sellers(
    db: DBSession,
    _: InternalAPIKey,
    actor_role: ActorRole,
    filter: str = Query(default="all"),
):
    if actor_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return list_admin_sellers(db, filter_type=filter)


@router.get("/admin/sellers/{seller_id}", response_model=AdminSellerDetailOut)
def admin_seller_detail(seller_id: str, db: DBSession, _: InternalAPIKey, actor_role: ActorRole):
    if actor_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return get_admin_seller_detail(db, seller_id)


@router.put("/admin/sellers/{seller_id}/status", response_model=AdminSellerDetailOut)
def admin_seller_status_update(
    seller_id: str,
    payload: AdminSellerStatusUpdateRequest,
    db: DBSession,
    _: InternalAPIKey,
    actor_role: ActorRole,
):
    if actor_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
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


@router.delete("/admin/sellers/{seller_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_seller_delete(
    seller_id: str, db: DBSession, _: InternalAPIKey, actor_role: ActorRole, actor_id: ActorUserId
):
    if actor_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    delete_seller(db, seller_id, admin_id=actor_id or "")


@router.patch("/admin/sellers/{seller_id}/blacklist", response_model=AdminSellerDetailOut)
def admin_seller_blacklist(
    seller_id: str,
    payload: SellerBlacklistIn,
    db: DBSession,
    _: InternalAPIKey,
    actor_role: ActorRole,
    actor_id: ActorUserId,
):
    if actor_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return toggle_seller_blacklist(db, seller_id, payload.blacklisted, admin_id=actor_id or "")


@router.get("/admin/products/top", response_model=TopProductsResponseOut)
def admin_top_products(
    db: DBSession,
    _: InternalAPIKey,
    actor_role: ActorRole,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=100),
):
    if actor_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    return list_top_products(db, page, limit)


# ── G23: Admin-editable site settings ────────────────────────────────────────

class SiteSettingIn(BaseModel):
    value: str


@router.get("/site-settings/{key}")
def get_site_setting(key: str, db: DBSession, _: InternalAPIKey):
    """Return the value of a site setting (public — e.g. main tagline)."""
    row = db.get(SiteSetting, key)
    return {"key": key, "value": row.value if row else ""}


@router.put("/admin/site-settings/{key}")
def set_site_setting(
    key: str,
    payload: SiteSettingIn,
    db: DBSession,
    _: InternalAPIKey,
    actor_role: ActorRole,
    actor_id: ActorUserId,
):
    """G23: Admin-only endpoint to update a site-wide setting (e.g. main_tagline)."""
    from app.services.audit import log_action  # noqa: PLC0415

    if actor_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    row = db.get(SiteSetting, key)
    old_value = row.value if row else ""
    if row is None:
        row = SiteSetting(key=key, value=payload.value, updated_by=actor_id)
        db.add(row)
    else:
        row.value = payload.value
        row.updated_by = actor_id

    log_action(
        db,
        actor_id=actor_id,
        action="site_setting.update",
        target_type="site_setting",
        target_id=key,
        payload={"from": old_value, "to": payload.value},
    )
    db.commit()
    return {"key": key, "value": row.value}


@router.get("/admin/site-settings")
def list_site_settings(db: DBSession, _: InternalAPIKey, actor_role: ActorRole):
    """G23: Admin-only list of all site settings."""
    if actor_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")
    rows = db.query(SiteSetting).order_by(SiteSetting.key).all()
    return [{"key": r.key, "value": r.value, "updatedAt": r.updated_at} for r in rows]

from datetime import datetime, timedelta, timezone
from math import ceil
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db.models import Product, SellerFollow, SellerReport, User
from app.services.auth import (
    _default_payment_info,
    _default_seller_contact,
    _default_shipping_address,
    _default_store_location,
)
from app.services.catalog import ProductListParams, _load_products, _product_to_dict


def _seller_query(include_inactive: bool = False):
    statement = select(User).where(
        User.role.in_(["vendor", "admin"]),
        User.store_name.is_not(None),
    )

    if include_inactive:
        return statement

    return statement.where(or_(User.role == "admin", User.seller_status == "active"))


def _resolve_seller(db: Session, identifier: str, *, include_inactive: bool = False) -> User:
    normalized_identifier = identifier.strip().lower()
    vendor = db.scalar(
        _seller_query(include_inactive).where(
            or_(
                User.id == identifier,
                User.store_slug == identifier,
                func.lower(User.store_name) == normalized_identifier,
            )
        )
    )

    if vendor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="vendor not found")

    return vendor


def _batch_seller_metrics(db: Session, seller_ids: list[str]) -> dict[str, dict]:
    """Fetch all metrics for a list of vendor IDs in 4 batch queries instead of 4N."""
    if not seller_ids:
        return {}

    follower_rows = db.execute(
        select(SellerFollow.seller_id, func.count(SellerFollow.id))
        .where(SellerFollow.seller_id.in_(seller_ids))
        .group_by(SellerFollow.seller_id)
    ).all()

    report_rows = db.execute(
        select(SellerReport.seller_id, func.count(SellerReport.id))
        .where(SellerReport.seller_id.in_(seller_ids))
        .group_by(SellerReport.seller_id)
    ).all()

    product_rows = db.execute(
        select(Product.seller_id, func.count(Product.id))
        .where(Product.seller_id.in_(seller_ids))
        .group_by(Product.seller_id)
    ).all()

    purchase_rows = db.execute(
        select(Product.seller_id, func.coalesce(func.sum(Product.purchase_count), 0))
        .where(Product.seller_id.in_(seller_ids))
        .group_by(Product.seller_id)
    ).all()

    metrics: dict[str, dict] = {
        sid: {"followerCount": 0, "reportCount": 0, "productCount": 0, "purchaseCount": 0}
        for sid in seller_ids
    }
    for sid, count in follower_rows:
        metrics[sid]["followerCount"] = int(count)
    for sid, count in report_rows:
        metrics[sid]["reportCount"] = int(count)
    for sid, count in product_rows:
        metrics[sid]["productCount"] = int(count)
    for sid, count in purchase_rows:
        metrics[sid]["purchaseCount"] = int(count)

    return metrics


def _seller_badge_label(vendor: User, purchase_count: int) -> str:
    custom_badge = (vendor.seller_badge or "").strip()
    if custom_badge:
        return custom_badge

    completed_deliveries = vendor.completed_deliveries or 0
    average_delivery_days = (
        float(vendor.average_delivery_days) if vendor.average_delivery_days is not None else None
    )

    if average_delivery_days is not None and average_delivery_days <= 2 and completed_deliveries >= 5:
        return "Fast delivery"

    if purchase_count >= 25 and completed_deliveries >= 10:
        return "Trusted vendor"

    if vendor.seller_status == "active" and vendor.government_id_verified:
        return "Verified vendor"

    return ""


def _serialize_seller_summary(vendor: User, metrics: dict) -> dict:
    seller_type = vendor.seller_type if vendor.seller_type in {"retail", "wholesale"} else "retail"
    average_delivery_days = (
        float(vendor.average_delivery_days) if vendor.average_delivery_days is not None else None
    )

    # G17: Public seller summary must NOT expose email, phone, or sellerContact PII.
    # G19: storeLocation in public view is restricted to city/state/country only (no addressLine1).
    raw_location = vendor.store_location or {}
    return {
        "id": vendor.id,
        "name": vendor.name,
        "role": vendor.role,
        "storeName": vendor.store_name or vendor.name,
        "storeSlug": vendor.store_slug or "",
        "storeTagline": vendor.store_tagline or "",
        "storeDescription": vendor.store_description or "",
        "storeLocation": {
            "city": raw_location.get("city", ""),
            "state": raw_location.get("state", ""),
            "country": raw_location.get("country", "Ghana"),
        },
        "sellerType": seller_type,
        "sellerStatus": vendor.seller_status or "buyer",
        "sellerBadge": _seller_badge_label(vendor, metrics["purchaseCount"]),
        "completedDeliveries": vendor.completed_deliveries or 0,
        "averageDeliveryDays": average_delivery_days,
        "sellerNotice": vendor.seller_notice or "",
        "governmentIdType": vendor.government_id_type or "ghana-card",
        "governmentIdVerified": bool(vendor.government_id_verified),
        "isBlacklisted": bool(vendor.is_blacklisted),
        "lastLoginAt": vendor.last_login_at,
        "followerCount": metrics["followerCount"],
        "productCount": metrics["productCount"],
        "purchaseCount": metrics["purchaseCount"],
        "reportCount": metrics["reportCount"],
        "startedAt": vendor.seller_started_at,
        "createdAt": vendor.created_at,
    }


def _serialize_admin_seller_summary(vendor: User, metrics: dict) -> dict:
    """Like _serialize_seller_summary but adds PII and admin-only fields."""
    raw_location = vendor.store_location or {}
    base = _serialize_seller_summary(vendor, metrics)
    return {
        **base,
        # PII fields: admin-only — never exposed in public summary (G17)
        "email": vendor.email,
        "phone": vendor.phone or "",
        "sellerContact": {
            **_default_seller_contact(vendor.email, vendor.phone or ""),
            **(vendor.seller_contact or {}),
        },
        # Full store address for admin (G19 restricts public view to city/state/country)
        "storeLocation": {
            **_default_store_location(),
            **raw_location,
        },
        "adminNote": vendor.admin_note or "",
        "governmentIdNumber": vendor.government_id_number or "",
        "niaVerifiedAt": vendor.nia_verified_at,
        "niaMatchConfidence": float(vendor.nia_match_confidence) if vendor.nia_match_confidence is not None else None,
        "onboardingStep": vendor.onboarding_step or 0,
        "rejectionReason": vendor.rejection_reason,
    }


def list_public_sellers(db: Session) -> list[dict]:
    sellers = db.scalars(
        _seller_query().order_by(User.seller_started_at.desc(), User.created_at.desc())
    ).all()
    seller_ids = [s.id for s in sellers]
    metrics = _batch_seller_metrics(db, seller_ids)
    return [_serialize_seller_summary(vendor, metrics[vendor.id]) for vendor in sellers]


def get_seller_detail(db: Session, identifier: str) -> dict:
    vendor = _resolve_seller(db, identifier)
    metrics = _batch_seller_metrics(db, [vendor.id])
    summary = _serialize_seller_summary(vendor, metrics[vendor.id])
    products = _load_products(
        db,
        ProductListParams(vendor=vendor.id, limit=24, sort="featured"),
    )

    return {
        **summary,
        "products": [_product_to_dict(product) for product in products],
    }


def follow_seller(db: Session, seller_id: str, follower_id: str) -> dict:
    vendor = _resolve_seller(db, seller_id)
    follower = db.get(User, follower_id)

    if follower is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buyer account not found")

    if follower.id == vendor.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="You cannot follow your own store",
        )

    existing_follow = db.scalar(
        select(SellerFollow).where(
            SellerFollow.seller_id == vendor.id,
            SellerFollow.follower_id == follower.id,
        )
    )
    if existing_follow is None:
        db.add(
            SellerFollow(
                id=f"follow-{uuid4().hex[:12]}",
                seller_id=vendor.id,
                follower_id=follower.id,
            )
        )
        db.commit()

    metrics = _batch_seller_metrics(db, [vendor.id])
    return _serialize_seller_summary(vendor, metrics[vendor.id])


def unfollow_seller(db: Session, seller_id: str, follower_id: str) -> dict:
    vendor = _resolve_seller(db, seller_id)
    follower = db.get(User, follower_id)

    if follower is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buyer account not found")

    existing_follow = db.scalar(
        select(SellerFollow).where(
            SellerFollow.seller_id == vendor.id,
            SellerFollow.follower_id == follower.id,
        )
    )
    if existing_follow is not None:
        db.delete(existing_follow)
        db.commit()

    metrics = _batch_seller_metrics(db, [vendor.id])
    return _serialize_seller_summary(vendor, metrics[vendor.id])


def report_seller(db: Session, seller_id: str, reporter_id: str, reason: str, details: str) -> dict:
    vendor = _resolve_seller(db, seller_id, include_inactive=True)
    reporter = db.get(User, reporter_id)

    if reporter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buyer account not found")

    if reporter.id == vendor.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="You cannot report your own store",
        )

    # One open report per reporter per vendor
    existing_report = db.scalar(
        select(SellerReport).where(
            SellerReport.seller_id == vendor.id,
            SellerReport.reporter_id == reporter.id,
            SellerReport.status == "open",
        )
    )
    if existing_report is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an open report against this vendor",
        )

    db.add(
        SellerReport(
            id=f"report-{uuid4().hex[:12]}",
            seller_id=vendor.id,
            reporter_id=reporter.id,
            reason=reason,
            details=details.strip() or None,
        )
    )
    db.commit()

    metrics = _batch_seller_metrics(db, [vendor.id])
    return _serialize_seller_summary(vendor, metrics[vendor.id])


def list_admin_sellers(db: Session, filter_type: str = "all") -> list[dict]:
    base = _seller_query(include_inactive=True).order_by(User.seller_started_at.desc(), User.created_at.desc())

    if filter_type == "blacklisted":
        base = base.where(User.is_blacklisted == True)  # noqa: E712
    elif filter_type == "inactive":
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)
        base = base.where(
            or_(
                User.last_login_at.is_(None),
                User.last_login_at < cutoff,
            )
        )

    sellers = db.scalars(base).all()
    seller_ids = [s.id for s in sellers]
    metrics = _batch_seller_metrics(db, seller_ids)
    return [_serialize_admin_seller_summary(vendor, metrics[vendor.id]) for vendor in sellers]


def get_admin_seller_detail(db: Session, seller_id: str) -> dict:
    vendor = _resolve_seller(db, seller_id, include_inactive=True)
    metrics = _batch_seller_metrics(db, [vendor.id])
    summary = _serialize_admin_seller_summary(vendor, metrics[vendor.id])

    reports = db.scalars(
        select(SellerReport)
        .where(SellerReport.seller_id == vendor.id)
        .order_by(SellerReport.created_at.desc())
    ).all()

    # Batch-load all reporter users in one query
    reporter_ids = list({r.reporter_id for r in reports if r.reporter_id})
    reporter_map: dict[str, str] = {}
    if reporter_ids:
        reporter_users = db.scalars(select(User).where(User.id.in_(reporter_ids))).all()
        reporter_map = {u.id: u.name for u in reporter_users}

    return {
        **summary,
        "governmentIdNumber": vendor.government_id_number or "",
        "niaVerifiedAt": vendor.nia_verified_at,
        "niaMatchConfidence": float(vendor.nia_match_confidence) if vendor.nia_match_confidence is not None else None,
        "onboardingStep": vendor.onboarding_step or 0,
        "rejectionReason": vendor.rejection_reason,
        "shippingAddress": {
            **_default_shipping_address(vendor.name),
            **(vendor.shipping_info or {}),
        },
        "paymentInfo": {
            **_default_payment_info(vendor.name),
            **(vendor.payment_info or {}),
        },
        "reports": [
            {
                "id": report.id,
                "reporterId": report.reporter_id,
                "reporterName": reporter_map.get(report.reporter_id, "Buyer"),
                "reason": report.reason,
                "details": report.details or "",
                "status": report.status,
                "createdAt": report.created_at,
            }
            for report in reports
        ],
    }


def update_admin_seller_status(
    db: Session,
    seller_id: str,
    status_value: str,
    seller_notice: str,
    admin_note: str,
    seller_badge: str,
    completed_deliveries: int,
    average_delivery_days: float | None,
    government_id_verified: bool,
) -> dict:
    vendor = _resolve_seller(db, seller_id, include_inactive=True)

    if vendor.role == "admin" and status_value != "active":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Admin-managed stores cannot be suspended or removed from the admin console",
        )

    from datetime import datetime, timezone  # noqa: PLC0415
    now = datetime.now(timezone.utc)

    prev_status = vendor.seller_status
    vendor.seller_status = status_value
    vendor.seller_notice = seller_notice.strip() or None
    vendor.admin_note = admin_note.strip() or None
    vendor.seller_badge = seller_badge.strip() or None
    vendor.completed_deliveries = max(completed_deliveries, 0)
    vendor.average_delivery_days = average_delivery_days
    # government_id_verified must be explicitly set by the admin; setting status to
    # "active" does NOT automatically mark the ID as verified.
    vendor.government_id_verified = government_id_verified

    # G37: record state-change timestamps.
    if status_value == "suspended" and prev_status != "suspended":
        vendor.suspended_at = now
    elif status_value == "verified" and prev_status != "verified":
        vendor.verified_at = now
    elif status_value == "rejected" and prev_status != "rejected":
        vendor.rejected_at = now

    db.add(vendor)
    db.commit()
    db.refresh(vendor)

    return get_admin_seller_detail(db, vendor.id)


def delete_seller(db: Session, seller_id: str, admin_id: str = "") -> None:
    """G26: soft-delete — set deleted_at timestamp instead of removing the row."""
    from datetime import datetime, timezone  # noqa: PLC0415
    from app.services.audit import log_action  # noqa: PLC0415

    vendor = _resolve_seller(db, seller_id, include_inactive=True)
    if vendor.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Admin accounts cannot be deleted via the vendor console",
        )
    now = datetime.now(timezone.utc)
    prev_status = vendor.seller_status
    # Soft-delete: mark the account as removed and set deleted_at.
    vendor.deleted_at = now
    vendor.seller_status = "removed"

    # G27: audit log
    log_action(
        db,
        actor_id=admin_id or None,
        action="seller.delete",
        target_type="user",
        target_id=seller_id,
        payload={"from_status": prev_status, "to_status": "removed", "soft_deleted": True},
    )
    db.commit()


def toggle_seller_blacklist(
    db: Session, seller_id: str, blacklisted: bool, admin_id: str = ""
) -> dict:
    from app.services.audit import log_action  # noqa: PLC0415

    vendor = _resolve_seller(db, seller_id, include_inactive=True)
    if vendor.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Admin accounts cannot be blacklisted",
        )
    prev = vendor.is_blacklisted
    vendor.is_blacklisted = blacklisted
    # Cascade blacklist state to all vendor products
    products = db.scalars(select(Product).where(Product.seller_id == vendor.id)).all()
    for product in products:
        product.is_blacklisted = blacklisted

    # G27: audit log
    action = "seller.blacklist" if blacklisted else "seller.unblacklist"
    log_action(
        db,
        actor_id=admin_id or None,
        action=action,
        target_type="user",
        target_id=seller_id,
        payload={"from": prev, "to": blacklisted, "products_affected": len(products)},
    )

    db.commit()
    db.refresh(vendor)
    return get_admin_seller_detail(db, vendor.id)


def list_verification_queue(db: Session) -> list[dict]:
    """All sellers with status pending_verification, newest first."""
    sellers = db.scalars(
        select(User)
        .where(User.seller_status == "pending_verification")
        .order_by(User.seller_started_at.asc(), User.created_at.asc())
    ).all()
    seller_ids = [s.id for s in sellers]
    metrics = _batch_seller_metrics(db, seller_ids)
    return [_serialize_admin_seller_summary(vendor, metrics[vendor.id]) for vendor in sellers]


def approve_seller(db: Session, seller_id: str, admin_id: str) -> dict:
    from app.services.audit import log_action  # noqa: PLC0415

    vendor = db.get(User, seller_id)
    if vendor is None:
        raise HTTPException(status_code=404, detail="vendor not found")
    if vendor.seller_status != "pending_verification":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve a vendor with status '{vendor.seller_status}'. "
                   "Only vendors with status 'pending_verification' can be approved.",
        )
    from datetime import datetime, timezone  # noqa: PLC0415
    now = datetime.now(timezone.utc)
    prev_status = vendor.seller_status
    # G16: set to "active" — the canonical "approved and can list products" state.
    # The spec calls this "verified" but the entire catalog/order stack checks "active".
    vendor.seller_status = "active"
    vendor.government_id_verified = True
    vendor.rejection_reason = None
    vendor.role = "vendor"
    vendor.verified_at = now  # G37: record timestamp of verification
    db.commit()

    # G27: audit log
    log_action(
        db,
        actor_id=admin_id,
        action="seller.approve",
        target_type="user",
        target_id=seller_id,
        payload={"from_status": prev_status, "to_status": "active"},
    )
    db.commit()

    from app.services import notifications as notif_svc
    notif_svc.notify(
        db,
        event_type="seller_approved",
        recipient_id=vendor.id,
        title="Your vendor account is verified! 🎉",
        body="Congratulations! Your Spree vendor account has been verified. "
             "You can now list products and start selling.",
        href="/dashboard/products/new",
        email_subject="Your Spree vendor account is approved",
        cta_label="Start selling",
    )

    return get_admin_seller_detail(db, seller_id)


def reject_seller(db: Session, seller_id: str, admin_id: str, reason: str) -> dict:
    from app.services.audit import log_action  # noqa: PLC0415

    if not reason or not reason.strip():
        raise HTTPException(status_code=400, detail="A rejection reason is required")
    vendor = db.get(User, seller_id)
    if vendor is None:
        raise HTTPException(status_code=404, detail="vendor not found")

    from datetime import datetime, timezone  # noqa: PLC0415
    now = datetime.now(timezone.utc)
    prev_status = vendor.seller_status
    vendor.seller_status = "rejected"
    vendor.rejection_reason = reason.strip()
    vendor.government_id_verified = False
    vendor.rejected_at = now  # G37: record timestamp of rejection
    db.commit()

    # G27: audit log
    log_action(
        db,
        actor_id=admin_id,
        action="seller.reject",
        target_type="user",
        target_id=seller_id,
        payload={"from_status": prev_status, "to_status": "rejected", "reason": reason.strip()},
    )
    db.commit()

    from app.services import notifications as notif_svc
    notif_svc.notify(
        db,
        event_type="seller_rejected",
        recipient_id=vendor.id,
        title="Vendor application not approved",
        body=f"We reviewed your documents and could not verify your account at this time. "
             f"Reason: {reason.strip()}. "
             "Please update your information and re-submit.",
        href="/vendor/register",
        email_subject="Spree vendor application — action required",
        cta_label="Re-submit application",
    )

    return get_admin_seller_detail(db, seller_id)


def list_top_products(db: Session, page: int = 1, limit: int = 100) -> dict:
    limit = min(max(limit, 1), 100)
    page = max(page, 1)
    offset = (page - 1) * limit

    # Rank by purchase_count + reviews_count + rating at DB level
    ranked_q = (
        select(Product)
        .order_by(
            Product.purchase_count.desc(),
            Product.reviews_count.desc(),
            Product.rating.desc(),
            Product.created_at.desc(),
        )
    )
    total = db.scalar(select(func.count(Product.id))) or 0
    total_pages = max(1, ceil(total / limit)) if total else 1
    products = db.scalars(ranked_q.offset(offset).limit(limit)).all()

    return {
        "items": [_product_to_dict(product) for product in products],
        "total": total,
        "page": page,
        "limit": limit,
        "totalPages": total_pages,
    }

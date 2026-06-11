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
        User.role.in_(["seller", "admin"]),
        User.store_name.is_not(None),
    )

    if include_inactive:
        return statement

    return statement.where(or_(User.role == "admin", User.seller_status == "active"))


def _resolve_seller(db: Session, identifier: str, *, include_inactive: bool = False) -> User:
    normalized_identifier = identifier.strip().lower()
    seller = db.scalar(
        _seller_query(include_inactive).where(
            or_(
                User.id == identifier,
                User.store_slug == identifier,
                func.lower(User.store_name) == normalized_identifier,
            )
        )
    )

    if seller is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller not found")

    return seller


def _batch_seller_metrics(db: Session, seller_ids: list[str]) -> dict[str, dict]:
    """Fetch all metrics for a list of seller IDs in 4 batch queries instead of 4N."""
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


def _seller_badge_label(seller: User, purchase_count: int) -> str:
    custom_badge = (seller.seller_badge or "").strip()
    if custom_badge:
        return custom_badge

    completed_deliveries = seller.completed_deliveries or 0
    average_delivery_days = (
        float(seller.average_delivery_days) if seller.average_delivery_days is not None else None
    )

    if average_delivery_days is not None and average_delivery_days <= 2 and completed_deliveries >= 5:
        return "Fast delivery"

    if purchase_count >= 25 and completed_deliveries >= 10:
        return "Trusted seller"

    if seller.seller_status == "active" and seller.government_id_verified:
        return "Verified seller"

    return ""


def _serialize_seller_summary(seller: User, metrics: dict) -> dict:
    seller_type = seller.seller_type if seller.seller_type in {"retail", "wholesale"} else "retail"
    average_delivery_days = (
        float(seller.average_delivery_days) if seller.average_delivery_days is not None else None
    )

    return {
        "id": seller.id,
        "name": seller.name,
        "email": seller.email,
        "role": seller.role,
        "phone": seller.phone or "",
        "storeName": seller.store_name or seller.name,
        "storeSlug": seller.store_slug or "",
        "storeTagline": seller.store_tagline or "",
        "storeDescription": seller.store_description or "",
        "storeLocation": {
            **_default_store_location(),
            **(seller.store_location or {}),
        },
        "sellerContact": {
            **_default_seller_contact(seller.email, seller.phone or ""),
            **(seller.seller_contact or {}),
        },
        "sellerType": seller_type,
        "sellerStatus": seller.seller_status or "buyer",
        "sellerBadge": _seller_badge_label(seller, metrics["purchaseCount"]),
        "completedDeliveries": seller.completed_deliveries or 0,
        "averageDeliveryDays": average_delivery_days,
        "sellerNotice": seller.seller_notice or "",
        "governmentIdType": seller.government_id_type or "ghana-card",
        "governmentIdVerified": bool(seller.government_id_verified),
        "isBlacklisted": bool(seller.is_blacklisted),
        "lastLoginAt": seller.last_login_at,
        "followerCount": metrics["followerCount"],
        "productCount": metrics["productCount"],
        "purchaseCount": metrics["purchaseCount"],
        "reportCount": metrics["reportCount"],
        "startedAt": seller.seller_started_at,
        "createdAt": seller.created_at,
    }


def _serialize_admin_seller_summary(seller: User, metrics: dict) -> dict:
    """Like _serialize_seller_summary but includes admin-only fields."""
    return {
        **_serialize_seller_summary(seller, metrics),
        "adminNote": seller.admin_note or "",
    }


def list_public_sellers(db: Session) -> list[dict]:
    sellers = db.scalars(
        _seller_query().order_by(User.seller_started_at.desc(), User.created_at.desc())
    ).all()
    seller_ids = [s.id for s in sellers]
    metrics = _batch_seller_metrics(db, seller_ids)
    return [_serialize_seller_summary(seller, metrics[seller.id]) for seller in sellers]


def get_seller_detail(db: Session, identifier: str) -> dict:
    seller = _resolve_seller(db, identifier)
    metrics = _batch_seller_metrics(db, [seller.id])
    summary = _serialize_seller_summary(seller, metrics[seller.id])
    products = _load_products(
        db,
        ProductListParams(seller=seller.id, limit=24, sort="featured"),
    )

    return {
        **summary,
        "products": [_product_to_dict(product) for product in products],
    }


def follow_seller(db: Session, seller_id: str, follower_id: str) -> dict:
    seller = _resolve_seller(db, seller_id)
    follower = db.get(User, follower_id)

    if follower is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buyer account not found")

    if follower.id == seller.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="You cannot follow your own store",
        )

    existing_follow = db.scalar(
        select(SellerFollow).where(
            SellerFollow.seller_id == seller.id,
            SellerFollow.follower_id == follower.id,
        )
    )
    if existing_follow is None:
        db.add(
            SellerFollow(
                id=f"follow-{uuid4().hex[:12]}",
                seller_id=seller.id,
                follower_id=follower.id,
            )
        )
        db.commit()

    metrics = _batch_seller_metrics(db, [seller.id])
    return _serialize_seller_summary(seller, metrics[seller.id])


def unfollow_seller(db: Session, seller_id: str, follower_id: str) -> dict:
    seller = _resolve_seller(db, seller_id)
    follower = db.get(User, follower_id)

    if follower is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buyer account not found")

    existing_follow = db.scalar(
        select(SellerFollow).where(
            SellerFollow.seller_id == seller.id,
            SellerFollow.follower_id == follower.id,
        )
    )
    if existing_follow is not None:
        db.delete(existing_follow)
        db.commit()

    metrics = _batch_seller_metrics(db, [seller.id])
    return _serialize_seller_summary(seller, metrics[seller.id])


def report_seller(db: Session, seller_id: str, reporter_id: str, reason: str, details: str) -> dict:
    seller = _resolve_seller(db, seller_id, include_inactive=True)
    reporter = db.get(User, reporter_id)

    if reporter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Buyer account not found")

    if reporter.id == seller.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="You cannot report your own store",
        )

    # One open report per reporter per seller
    existing_report = db.scalar(
        select(SellerReport).where(
            SellerReport.seller_id == seller.id,
            SellerReport.reporter_id == reporter.id,
            SellerReport.status == "open",
        )
    )
    if existing_report is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an open report against this seller",
        )

    db.add(
        SellerReport(
            id=f"report-{uuid4().hex[:12]}",
            seller_id=seller.id,
            reporter_id=reporter.id,
            reason=reason,
            details=details.strip() or None,
        )
    )
    db.commit()

    metrics = _batch_seller_metrics(db, [seller.id])
    return _serialize_seller_summary(seller, metrics[seller.id])


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
    return [_serialize_admin_seller_summary(seller, metrics[seller.id]) for seller in sellers]


def get_admin_seller_detail(db: Session, seller_id: str) -> dict:
    seller = _resolve_seller(db, seller_id, include_inactive=True)
    metrics = _batch_seller_metrics(db, [seller.id])
    summary = _serialize_admin_seller_summary(seller, metrics[seller.id])

    reports = db.scalars(
        select(SellerReport)
        .where(SellerReport.seller_id == seller.id)
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
        "governmentIdNumber": seller.government_id_number or "",
        "idFrontUrl": seller.id_front_url or "",
        "idBackUrl": seller.id_back_url or "",
        "selfieUrl": seller.selfie_url or "",
        "shippingAddress": {
            **_default_shipping_address(seller.name),
            **(seller.shipping_info or {}),
        },
        "paymentInfo": {
            **_default_payment_info(seller.name),
            **(seller.payment_info or {}),
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
    seller = _resolve_seller(db, seller_id, include_inactive=True)

    if seller.role == "admin" and status_value != "active":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Admin-managed stores cannot be suspended or removed from the admin console",
        )

    seller.seller_status = status_value
    seller.seller_notice = seller_notice.strip() or None
    seller.admin_note = admin_note.strip() or None
    seller.seller_badge = seller_badge.strip() or None
    seller.completed_deliveries = max(completed_deliveries, 0)
    seller.average_delivery_days = average_delivery_days
    # government_id_verified must be explicitly set by the admin; setting status to
    # "active" does NOT automatically mark the ID as verified.
    seller.government_id_verified = government_id_verified
    db.add(seller)
    db.commit()
    db.refresh(seller)

    return get_admin_seller_detail(db, seller.id)


def delete_seller(db: Session, seller_id: str) -> None:
    seller = _resolve_seller(db, seller_id, include_inactive=True)
    if seller.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Admin accounts cannot be deleted via the seller console",
        )
    db.delete(seller)
    db.commit()


def toggle_seller_blacklist(db: Session, seller_id: str, blacklisted: bool) -> dict:
    seller = _resolve_seller(db, seller_id, include_inactive=True)
    if seller.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Admin accounts cannot be blacklisted",
        )
    seller.is_blacklisted = blacklisted
    # Cascade blacklist state to all seller products
    products = db.scalars(select(Product).where(Product.seller_id == seller.id)).all()
    for product in products:
        product.is_blacklisted = blacklisted
    db.commit()
    db.refresh(seller)
    return get_admin_seller_detail(db, seller.id)


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

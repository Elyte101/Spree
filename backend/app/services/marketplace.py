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


def _seller_metrics(db: Session, seller_id: str) -> dict:
    follower_count = (
        db.scalar(select(func.count(SellerFollow.id)).where(SellerFollow.seller_id == seller_id)) or 0
    )
    report_count = (
        db.scalar(select(func.count(SellerReport.id)).where(SellerReport.seller_id == seller_id)) or 0
    )
    product_count = (
        db.scalar(select(func.count(Product.id)).where(Product.seller_id == seller_id)) or 0
    )
    purchase_count = (
        db.scalar(
            select(func.coalesce(func.sum(Product.purchase_count), 0)).where(Product.seller_id == seller_id)
        )
        or 0
    )

    return {
        "followerCount": int(follower_count),
        "reportCount": int(report_count),
        "productCount": int(product_count),
        "purchaseCount": int(purchase_count),
    }


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


def _serialize_seller_summary(db: Session, seller: User) -> dict:
    metrics = _seller_metrics(db, seller.id)
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
        "adminNote": seller.admin_note or "",
        "governmentIdType": seller.government_id_type or "ghana-card",
        "governmentIdVerified": bool(seller.government_id_verified),
        "followerCount": metrics["followerCount"],
        "productCount": metrics["productCount"],
        "purchaseCount": metrics["purchaseCount"],
        "reportCount": metrics["reportCount"],
        "startedAt": seller.seller_started_at,
        "createdAt": seller.created_at,
    }


def list_public_sellers(db: Session) -> list[dict]:
    sellers = db.scalars(_seller_query().order_by(User.seller_started_at.desc(), User.created_at.desc())).all()
    return [_serialize_seller_summary(db, seller) for seller in sellers]


def get_seller_detail(db: Session, identifier: str) -> dict:
    seller = _resolve_seller(db, identifier)
    summary = _serialize_seller_summary(db, seller)
    products = _load_products(
        db,
        ProductListParams(seller=seller.id, limit=24, sort="featured"),
    )

    return {
        **summary,
        "products": [_product_to_dict(product) for product in products[:24]],
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

    return _serialize_seller_summary(db, seller)


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

    return _serialize_seller_summary(db, seller)


def list_admin_sellers(db: Session) -> list[dict]:
    sellers = db.scalars(
        _seller_query(include_inactive=True).order_by(User.seller_started_at.desc(), User.created_at.desc())
    ).all()
    return [_serialize_seller_summary(db, seller) for seller in sellers]


def get_admin_seller_detail(db: Session, seller_id: str) -> dict:
    seller = _resolve_seller(db, seller_id, include_inactive=True)
    summary = _serialize_seller_summary(db, seller)
    reports = db.scalars(
        select(SellerReport).where(SellerReport.seller_id == seller.id).order_by(SellerReport.created_at.desc())
    ).all()

    return {
        **summary,
        "governmentIdNumber": seller.government_id_number or "",
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
                "reporterName": db.get(User, report.reporter_id).name if db.get(User, report.reporter_id) else "Buyer",
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
    seller.government_id_verified = government_id_verified or status_value == "active"
    db.add(seller)
    db.commit()
    db.refresh(seller)

    return get_admin_seller_detail(db, seller.id)


def list_top_products(db: Session, page: int = 1, limit: int = 100) -> dict:
    limit = min(max(limit, 1), 100)
    page = max(page, 1)
    ranked_products = _load_products(
        db,
        ProductListParams(sort="featured", limit=500),
        include_inactive_sellers=True,
    )
    ranked_products = sorted(
        ranked_products,
        key=lambda product: (
            product.purchase_count,
            product.reviews_count,
            product.rating,
            product.created_at,
        ),
        reverse=True,
    )[:500]
    total = len(ranked_products)
    total_pages = max(1, ceil(total / limit)) if total else 1
    start = (page - 1) * limit
    end = start + limit

    return {
        "items": [_product_to_dict(product) for product in ranked_products[start:end]],
        "total": total,
        "page": page,
        "limit": limit,
        "totalPages": total_pages,
    }

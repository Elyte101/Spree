import re
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.db.models import User
from app.schemas.auth import ProfileUpdateRequest, SignupRequest

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
GHANA_CARD_PATTERN = re.compile(r"^[A-Z0-9-]{8,32}$")


def _normalize_email(email: str) -> str:
    normalized = email.lower().strip()
    if not EMAIL_PATTERN.fullmatch(normalized):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please provide a valid email address",
        )
    return normalized


def _validate_password_strength(password: str) -> None:
    checks = [
        any(character.islower() for character in password),
        any(character.isupper() for character in password),
        any(character.isdigit() for character in password),
        any(not character.isalnum() for character in password),
    ]

    if len(password) < 8 or not all(checks):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must include upper, lower, number, and symbol characters",
        )


def _slugify_store(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower().strip()).strip("-") or "store"


def _serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
    }


def _default_shipping_address(name: str = "") -> dict:
    return {
        "fullName": name,
        "addressLine1": "",
        "addressLine2": "",
        "city": "",
        "state": "",
        "postalCode": "",
        "country": "",
    }


def _default_payment_info(name: str = "") -> dict:
    return {
        "method": "card",
        "cardholderName": name,
        "cardLast4": "",
        "expiryMonth": "",
        "expiryYear": "",
        "billingPostalCode": "",
    }


def _default_store_location() -> dict:
    return {
        "addressLine1": "",
        "city": "",
        "state": "",
        "postalCode": "",
        "country": "",
    }


def _default_seller_contact(email: str = "", phone: str = "") -> dict:
    return {
        "businessEmail": email,
        "businessPhone": phone,
        "whatsapp": "",
        "registrationNumber": "",
    }


def _clean_store_location(location: dict) -> dict:
    return {
        "addressLine1": str(location.get("addressLine1", "")).strip(),
        "city": str(location.get("city", "")).strip(),
        "state": str(location.get("state", "")).strip(),
        "postalCode": str(location.get("postalCode", "")).strip(),
        "country": str(location.get("country", "")).strip(),
    }


def _clean_seller_contact(contact: dict) -> dict:
    return {
        "businessEmail": str(contact.get("businessEmail", "")).lower().strip(),
        "businessPhone": str(contact.get("businessPhone", "")).strip(),
        "whatsapp": str(contact.get("whatsapp", "")).strip(),
        "registrationNumber": str(contact.get("registrationNumber", "")).strip(),
    }


def _serialize_profile(user: User) -> dict:
    shipping_info = user.shipping_info or {}
    payment_info = user.payment_info or {}
    store_location = user.store_location or {}
    seller_contact = user.seller_contact or {}
    seller_type = user.seller_type if user.seller_type in {"retail", "wholesale"} else "retail"
    seller_status = user.seller_status if user.seller_status in {
        "buyer",
        "pending",
        "active",
        "suspended",
        "removed",
    } else "buyer"
    average_delivery_days = (
        float(user.average_delivery_days) if user.average_delivery_days is not None else None
    )

    return {
        **_serialize_user(user),
        "phone": user.phone or "",
        "storeName": user.store_name or "",
        "storeSlug": user.store_slug or "",
        "storeTagline": user.store_tagline or "",
        "storeDescription": user.store_description or "",
        "storeLocation": {
            **_default_store_location(),
            **store_location,
        },
        "sellerContact": {
            **_default_seller_contact(user.email, user.phone or ""),
            **seller_contact,
        },
        "sellerType": seller_type,
        "sellerStatus": seller_status,
        "sellerBadge": user.seller_badge or "",
        "completedDeliveries": user.completed_deliveries or 0,
        "averageDeliveryDays": average_delivery_days,
        "sellerNotice": user.seller_notice or "",
        "adminNote": user.admin_note or "",
        "governmentIdType": user.government_id_type or "ghana-card",
        "governmentIdNumber": user.government_id_number or "",
        "governmentIdVerified": bool(user.government_id_verified),
        "sellerStartedAt": user.seller_started_at,
        "sellerIdentity": {
            "governmentIdType": user.government_id_type or "ghana-card",
            "governmentIdNumber": user.government_id_number or "",
            "storeTagline": user.store_tagline or "",
        },
        "shippingAddress": {
            **_default_shipping_address(user.name),
            **shipping_info,
        },
        "paymentInfo": {
            **_default_payment_info(user.name),
            **payment_info,
        },
    }


def authenticate_user(db: Session, email: str, password: str) -> dict | None:
    user = db.scalar(select(User).where(User.email == email.lower().strip()))

    if user is None or not verify_password(password, user.password_hash):
        return None

    return _serialize_user(user)


def register_user(db: Session, payload: SignupRequest) -> dict:
    email = _normalize_email(payload.email)
    _validate_password_strength(payload.password)
    name = payload.name.strip()

    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please provide your name",
        )

    existing_user = db.scalar(select(User).where(User.email == email))
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists for that email address",
        )

    user = User(
        id=f"user-{uuid4().hex[:12]}",
        name=name,
        email=email,
        password_hash=hash_password(payload.password),
        role="customer",
        seller_status="buyer",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return _serialize_user(user)


def get_user_profile(db: Session, user_id: str) -> dict:
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )

    return _serialize_profile(user)


def update_user_profile(db: Session, user_id: str, payload: ProfileUpdateRequest) -> dict:
    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )

    email = _normalize_email(payload.email)
    name = payload.name.strip()
    phone = payload.phone.strip()
    store_name = payload.storeName.strip()
    store_slug = _slugify_store(store_name) if store_name else ""
    store_tagline = payload.sellerIdentity.storeTagline.strip()
    store_description = payload.storeDescription.strip()
    store_location = _clean_store_location(payload.storeLocation.model_dump())
    seller_contact = _clean_seller_contact(payload.sellerContact.model_dump())
    seller_type = payload.sellerType
    government_id_type = payload.sellerIdentity.governmentIdType
    government_id_number = payload.sellerIdentity.governmentIdNumber.strip().upper()

    if not name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please provide your name",
        )

    existing_user = db.scalar(select(User).where(User.email == email, User.id != user_id))
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Another account already uses that email address",
        )

    if store_slug:
        existing_store = db.scalar(
            select(User).where(User.store_slug == store_slug, User.id != user_id)
        )
        if existing_store is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="That store handle is already taken by another seller",
            )

    moderated_seller_status = user.seller_status in {"suspended", "removed"} and user.role != "admin"
    wants_seller_access = (
        payload.isSeller
        or moderated_seller_status
        or (user.role == "admin" and bool(store_name))
    )

    if wants_seller_access:
        if not store_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Please name your store before enabling seller access",
            )

        if len(store_description) < 24:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Please add a fuller store description so buyers know what you sell",
            )

        if not all(
            store_location[field]
            for field in ("addressLine1", "city", "state", "country")
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Please add your store address, city, region, and country before applying to sell",
            )

        if seller_contact["businessEmail"] and not EMAIL_PATTERN.fullmatch(
            seller_contact["businessEmail"]
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Please provide a valid seller business email",
            )

        if not (seller_contact["businessPhone"] or phone):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Please add a business phone number before applying to sell",
            )

        if not government_id_number:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A government ID is required before buyer accounts can become sellers",
            )

        if government_id_type == "ghana-card" and not GHANA_CARD_PATTERN.fullmatch(government_id_number):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Please enter a valid Ghana Card number",
            )

    user.name = name
    user.email = email
    user.phone = phone or None
    user.store_name = store_name or None
    user.store_slug = store_slug or None
    user.store_tagline = store_tagline or None
    user.store_description = store_description or None
    user.store_location = store_location if wants_seller_access or store_name else None
    user.seller_contact = seller_contact if wants_seller_access or store_name else None
    user.seller_type = seller_type if wants_seller_access or store_name else "retail"
    user.government_id_type = government_id_type if wants_seller_access else None
    user.government_id_number = government_id_number if wants_seller_access else None
    user.shipping_info = payload.shippingAddress.model_dump()
    user.payment_info = payload.paymentInfo.model_dump()

    if wants_seller_access and user.seller_started_at is None:
        user.seller_started_at = datetime.now(timezone.utc)

    if user.role != "admin":
        if moderated_seller_status:
            user.role = "seller"
        else:
            user.role = "seller" if payload.isSeller else "customer"
            if payload.isSeller:
                user.seller_status = "active" if user.seller_status == "active" else "pending"
            else:
                user.seller_status = "buyer"
    else:
        user.seller_status = "active"

    db.add(user)
    db.commit()
    db.refresh(user)

    return _serialize_profile(user)

import re
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.db.models import User
from app.schemas.auth import ProfileUpdateRequest, SignupRequest

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


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


def _serialize_profile(user: User) -> dict:
    shipping_info = user.shipping_info or {}
    payment_info = user.payment_info or {}

    return {
        **_serialize_user(user),
        "phone": user.phone or "",
        "storeName": user.store_name or "",
        "storeDescription": user.store_description or "",
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
    store_description = payload.storeDescription.strip()

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

    if payload.isSeller and user.role != "admin" and not store_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Please name your store before enabling seller access",
        )

    user.name = name
    user.email = email
    user.phone = phone or None
    user.store_name = store_name or None
    user.store_description = store_description or None
    user.shipping_info = payload.shippingAddress.model_dump()
    user.payment_info = payload.paymentInfo.model_dump()

    if user.role != "admin":
        user.role = "seller" if payload.isSeller else "customer"

    db.add(user)
    db.commit()
    db.refresh(user)

    return _serialize_profile(user)

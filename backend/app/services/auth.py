import re
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.db.models import User, VerificationToken
from app.schemas.auth import OAuthUpsertRequest, PayoutInfoRequest, ProfileUpdateRequest, SignupRequest
from app.services import paystack as paystack_svc
from app.services.uploads import delete_upload, save_upload

# RFC 5321/5322 permissive but sane — accepts user+tag@sub.domain.tld
EMAIL_PATTERN = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
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
        "email_verified": bool(user.email_verified),
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
        "payoutInfo": user.payout_info or {},
        "idFrontUrl": user.id_front_url or "",
        "idBackUrl": user.id_back_url or "",
        "selfieUrl": user.selfie_url or "",
    }


def authenticate_user(db: Session, email: str, password: str) -> dict | None:
    user = db.scalar(select(User).where(User.email == email.lower().strip()))

    if user is None or not verify_password(password, user.password_hash):
        return None

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

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


def upsert_oauth_user(db: Session, req: OAuthUpsertRequest) -> dict:
    email = req.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))

    if user is not None:
        if not user.oauth_provider:
            user.oauth_provider = req.provider
            user.oauth_provider_id = req.provider_account_id
        user.email_verified = True
        db.commit()
        db.refresh(user)
        return _serialize_user(user)

    user = User(
        id=f"user-{uuid4().hex[:12]}",
        name=req.name.strip() or email.split("@")[0],
        email=email,
        password_hash="",
        role="customer",
        seller_status="buyer",
        oauth_provider=req.provider,
        oauth_provider_id=req.provider_account_id,
        email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


def create_verification_token(db: Session, email: str) -> str:
    email = email.lower().strip()
    db.execute(delete(VerificationToken).where(VerificationToken.email == email))
    token = secrets.token_urlsafe(32)
    vt = VerificationToken(
        id=uuid4().hex,
        email=email,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(vt)
    db.commit()
    return token


def verify_email_token(db: Session, token: str) -> dict | None:
    vt = db.scalar(
        select(VerificationToken).where(
            VerificationToken.token == token,
            VerificationToken.expires_at > datetime.now(timezone.utc),
        )
    )
    if not vt:
        return None
    user = db.scalar(select(User).where(User.email == vt.email))
    if not user:
        return None
    user.email_verified = True
    db.delete(vt)
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


def upload_id_documents(
    db: Session,
    user_id: str,
    id_front: UploadFile | None,
    id_back: UploadFile | None,
    selfie: UploadFile | None,
) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if id_front is not None:
        if user.id_front_url:
            delete_upload(user.id_front_url)
        user.id_front_url = save_upload(id_front, user_id, "id_front")

    if id_back is not None:
        if user.id_back_url:
            delete_upload(user.id_back_url)
        user.id_back_url = save_upload(id_back, user_id, "id_back")

    if selfie is not None:
        if user.selfie_url:
            delete_upload(user.selfie_url)
        user.selfie_url = save_upload(selfie, user_id, "selfie")

    # Reset verification whenever documents are re-uploaded
    user.government_id_verified = False

    db.add(user)
    db.commit()
    db.refresh(user)
    return _serialize_profile(user)


def update_payout_info(db: Session, user_id: str, payload: "PayoutInfoRequest") -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    payout = {
        "method": payload.method,
        "bankName": payload.bankName,
        "accountNumber": payload.accountNumber,
        "bankCode": payload.bankCode,
        "mobileMoneyNetwork": payload.mobileMoneyNetwork,
        "mobileMoneyNumber": payload.mobileMoneyNumber,
        "currency": payload.currency,
        "accountName": payload.accountName,
    }
    user.payout_info = payout

    # Create or refresh the Paystack transfer recipient
    if settings.paystack_secret_key and payload.accountNumber:
        try:
            recipient_code = paystack_svc.create_transfer_recipient(
                name=payload.accountName or user.name,
                account_number=payload.accountNumber,
                bank_code=payload.bankCode,
                mobile_money_network=payload.mobileMoneyNetwork,
                currency=payload.currency,
            )
            user.paystack_recipient_code = recipient_code
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Could not register payout account with Paystack: {exc}",
            ) from exc

    db.add(user)
    db.commit()
    db.refresh(user)
    return _serialize_profile(user)

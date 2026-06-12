"""Seller onboarding wizard — step-by-step registration with resume support."""
from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import User
from app.schemas.auth import (
    OnboardingStep1Request,
    OnboardingStep2Request,
    OnboardingStep3Request,
    OnboardingStep4Request,
    OnboardingStep5Request,
)
from app.services import notifications as notif_svc
from app.services.auth import _serialize_profile, _slugify_store

GHANA_CARD_PATTERN = re.compile(r"^[A-Z0-9-]{8,32}$")


def get_onboarding_state(db: Session, user_id: str) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "step": user.onboarding_step,
        "profile": _serialize_profile(user),
    }


def save_step1(db: Session, user_id: str, payload: OnboardingStep1Request) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    user.name = payload.name.strip()
    user.phone = payload.phone.strip()
    if user.onboarding_step < 1:
        user.onboarding_step = 1
    if user.seller_status == "buyer":
        user.seller_status = "incomplete"
        user.seller_started_at = user.seller_started_at or datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return _serialize_profile(user)


def save_step2(db: Session, user_id: str, payload: OnboardingStep2Request) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.onboarding_step < 1:
        raise HTTPException(status_code=400, detail="Complete step 1 first")

    user.store_location = {
        "country": payload.country,
        "state": payload.state,
        "city": payload.city,
        "addressLine1": payload.addressLine1,
        "postalCode": payload.postalCode,
    }
    if user.onboarding_step < 2:
        user.onboarding_step = 2
    db.commit()
    db.refresh(user)
    return _serialize_profile(user)


def save_step3(db: Session, user_id: str, payload: OnboardingStep3Request) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.onboarding_step < 2:
        raise HTTPException(status_code=400, detail="Complete step 2 first")

    store_slug = _slugify_store(payload.storeName)
    existing = db.scalar(
        select(User).where(User.store_slug == store_slug, User.id != user_id)
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That store name is already taken — try adding your city or a unique word",
        )

    user.store_name = payload.storeName.strip()
    user.store_slug = store_slug
    user.store_tagline = payload.storeTagline.strip() or None
    user.store_description = payload.storeDescription.strip()
    user.seller_type = payload.sellerType
    if payload.registrationNumber:
        contact = user.seller_contact or {}
        contact["registrationNumber"] = payload.registrationNumber.strip()
        user.seller_contact = contact
    if payload.logoUrl:
        # Store logo URL in seller_contact.logoUrl for display
        contact = user.seller_contact or {}
        contact["logoUrl"] = payload.logoUrl
        user.seller_contact = contact
    if user.onboarding_step < 3:
        user.onboarding_step = 3
    db.commit()
    db.refresh(user)
    return _serialize_profile(user)


def save_step4(db: Session, user_id: str, payload: OnboardingStep4Request) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.onboarding_step < 3:
        raise HTTPException(status_code=400, detail="Complete step 3 first")

    id_number = payload.governmentIdNumber.strip().upper()
    if payload.governmentIdType == "ghana-card" and not GHANA_CARD_PATTERN.fullmatch(id_number):
        raise HTTPException(
            status_code=422,
            detail="Please enter a valid Ghana Card number (e.g. GHA-123456789-0)",
        )

    user.government_id_type = payload.governmentIdType
    user.government_id_number = id_number
    user.id_front_url = payload.idFrontUrl
    user.id_back_url = payload.idBackUrl
    user.selfie_url = payload.selfieUrl
    user.government_id_verified = False
    if user.onboarding_step < 4:
        user.onboarding_step = 4
    db.commit()
    db.refresh(user)
    return _serialize_profile(user)


def save_step5(db: Session, user_id: str, payload: OnboardingStep5Request) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.onboarding_step < 4:
        raise HTTPException(status_code=400, detail="Complete step 4 first")

    user.payout_info = {
        "method": payload.method,
        "bankName": payload.bankName,
        "accountNumber": payload.accountNumber,
        "bankCode": payload.bankCode,
        "mobileMoneyNetwork": payload.mobileMoneyNetwork,
        "mobileMoneyNumber": payload.mobileMoneyNumber,
        "currency": payload.currency,
        "accountName": payload.accountName,
    }
    if user.onboarding_step < 5:
        user.onboarding_step = 5
    db.commit()
    db.refresh(user)
    return _serialize_profile(user)


def submit_onboarding(db: Session, user_id: str) -> dict:
    """Finalise onboarding — validate all steps complete, set pending_verification."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.onboarding_step < 5:
        raise HTTPException(
            status_code=400,
            detail=f"Onboarding incomplete — you are on step {user.onboarding_step} of 5",
        )

    if not all([user.id_front_url, user.id_back_url, user.selfie_url]):
        raise HTTPException(status_code=400, detail="Identity documents are required")

    if not user.store_name:
        raise HTTPException(status_code=400, detail="Store details are required")

    user.seller_status = "pending_verification"
    user.role = "seller"
    user.seller_started_at = user.seller_started_at or datetime.now(timezone.utc)
    db.commit()

    # Notify the seller
    notif_svc.notify(
        db,
        event_type="docs_submitted",
        recipient_id=user_id,
        title="Documents submitted",
        body="We've received your identity documents and will review them shortly. "
             "We aim to verify accounts within 1–2 business days.",
        href="/settings",
        email_subject="Your Spree seller application is under review",
        cta_label="View your profile",
        cta_url=f"{settings.frontend_url}/settings",
    )

    # Notify all admins
    from sqlalchemy import select as _sel
    admins = db.scalars(_sel(User).where(User.role == "admin")).all()
    for admin in admins:
        notif_svc.notify(
            db,
            event_type="new_verification_pending",
            recipient_id=admin.id,
            title="New seller awaiting verification",
            body=f"{user.name} ({user.email}) has submitted their documents. "
                 "Review their application in the verification queue.",
            href="/dashboard/verification",
            email_subject="New seller verification request",
            cta_label="Review now",
            cta_url=f"{settings.frontend_url}/dashboard/verification",
        )

    db.refresh(user)
    return _serialize_profile(user)

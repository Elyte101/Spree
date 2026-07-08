"""vendor onboarding wizard — step-by-step registration with resume support."""
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
from app.services.encryption import encrypt

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

    # G32: strip HTML from text fields to prevent XSS
    import re as _re  # noqa: PLC0415
    def _strip_html(v: str) -> str:
        return _re.sub(r"<[^>]+>", "", v).strip()

    user.store_name = payload.storeName.strip()
    user.store_slug = store_slug
    user.store_tagline = _strip_html(payload.storeTagline) or None
    user.store_description = _strip_html(payload.storeDescription)
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

    user.government_id_type = payload.governmentIdType
    # G13: encrypt sensitive fields at rest.
    # government_id_verified stays False until /identity/face-verify passes.
    user.government_id_number = encrypt(id_number)
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

    # G13: payout details encrypted at rest.
    import json as _json  # noqa: PLC0415
    payout_plain = {
        "method": payload.method,
        "mobileMoneyNetwork": payload.mobileMoneyNetwork or "",
        "mobileMoneyNumber": payload.mobileMoneyNumber or "",
        "bankCode": payload.bankCode or "",
        "bankName": payload.bankName or "",
        "accountNumber": payload.accountNumber or "",
        "currency": payload.currency or "GHS",
        "accountName": payload.accountName,
    }
    user.payout_info = {"__enc__": encrypt(_json.dumps(payout_plain))}

    # Create Paystack transfer recipient now, so submit_onboarding can validate
    # that a working payout account exists before going to pending_verification.
    if settings.paystack_secret_key:
        from app.services import paystack as paystack_svc  # noqa: PLC0415
        try:
            if payload.method == "mobile_money":
                from app.services.orders import _MOMO_NETWORK_BANK_CODE  # noqa: PLC0415
                bank_code = _MOMO_NETWORK_BANK_CODE.get((payload.mobileMoneyNetwork or "").lower(), "")
                if not bank_code or not payload.mobileMoneyNumber:
                    raise HTTPException(
                        status_code=422,
                        detail="Mobile money number and network are required for payout",
                    )
                code = paystack_svc.create_transfer_recipient(
                    name=payload.accountName,
                    account_number=payload.mobileMoneyNumber.strip(),
                    mobile_money_network=bank_code,
                    currency=payload.currency or "GHS",
                )
            else:  # bank
                if not payload.bankCode or not payload.accountNumber:
                    raise HTTPException(
                        status_code=422,
                        detail="Bank code and account number are required for bank payout",
                    )
                code = paystack_svc.create_transfer_recipient(
                    name=payload.accountName,
                    account_number=payload.accountNumber.strip(),
                    bank_code=payload.bankCode.strip(),
                    currency=payload.currency or "GHS",
                )
            if code:
                user.paystack_recipient_code = code
            else:
                raise HTTPException(
                    status_code=502,
                    detail="Could not register payout account with Paystack. Please check your details and try again.",
                )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Could not register payout account with Paystack. Please check your details and try again.",
            ) from exc

    if user.onboarding_step < 5:
        user.onboarding_step = 5
    db.commit()
    db.refresh(user)
    return _serialize_profile(user)


def submit_onboarding(db: Session, user_id: str) -> dict:
    """Finalise onboarding — validate all steps complete, set pending_verification.

    G35: Rejected sellers can resubmit after updating their documents.
    Blocked states: pending_verification (already submitted, awaiting review),
    active/verified (already approved), suspended/removed (admin action required).
    """
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # G35: guard against invalid resubmit states
    blocked_statuses = {"pending_verification", "active", "suspended", "removed"}
    if user.seller_status in blocked_statuses:
        if user.seller_status == "pending_verification":
            raise HTTPException(
                status_code=409,
                detail="Your application is already under review. We'll notify you once a decision is made.",
            )
        if user.seller_status in ("active", "verified"):
            raise HTTPException(
                status_code=409,
                detail="Your seller account is already active.",
            )
        raise HTTPException(
            status_code=409,
            detail="Your account is not eligible for resubmission. Please contact support.",
        )

    if user.onboarding_step < 5:
        raise HTTPException(
            status_code=400,
            detail=f"Onboarding incomplete — you are on step {user.onboarding_step} of 5",
        )

    if not user.government_id_verified:
        raise HTTPException(
            status_code=400,
            detail="Identity verification is required before submitting. "
                   "Please complete the Ghana Card NIA lookup and face match.",
        )

    if not user.payout_info:
        raise HTTPException(
            status_code=400,
            detail="Payout account setup is required. Complete step 5 with your mobile money or bank details.",
        )

    if settings.paystack_secret_key and not user.paystack_recipient_code:
        raise HTTPException(
            status_code=400,
            detail="Payout account setup is incomplete. Please re-submit your payout details in step 5.",
        )

    if not user.store_name:
        raise HTTPException(status_code=400, detail="Store details are required")

    is_resubmit = user.seller_status == "rejected"
    user.seller_status = "pending_verification"
    user.role = "vendor"
    user.seller_started_at = user.seller_started_at or datetime.now(timezone.utc)
    # Clear rejection timestamps on resubmit so the timeline is clean
    if is_resubmit:
        user.rejected_at = None
        user.rejection_reason = None
    db.commit()

    # Notify the vendor
    notif_body = (
        "We've received your updated documents and will re-review your application shortly. "
        "We aim to verify accounts within 1–2 business days."
        if is_resubmit
        else "We've received your identity documents and will review them shortly. "
             "We aim to verify accounts within 1–2 business days."
    )
    notif_svc.notify(
        db,
        event_type="docs_submitted",
        recipient_id=user_id,
        title="Documents submitted" if not is_resubmit else "Documents resubmitted",
        body=notif_body,
        href="/settings",
        email_subject="Your Spree vendor application is under review",
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
            title="Vendor resubmitted documents" if is_resubmit else "New vendor awaiting verification",
            body=f"{user.name} ({user.email}) has {'resubmitted' if is_resubmit else 'submitted'} their documents. "
                 "Review their application in the verification queue.",
            href="/dashboard/verification",
            email_subject="Vendor verification request" + (" (resubmit)" if is_resubmit else ""),
            cta_label="Review now",
            cta_url=f"{settings.frontend_url}/dashboard/verification",
        )

    db.refresh(user)
    return _serialize_profile(user)

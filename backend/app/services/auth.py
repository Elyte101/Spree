import re
import secrets
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.common_passwords import COMMON_PASSWORDS
from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.db.models import RateLimitEvent, User, VerificationToken
from app.schemas.auth import OAuthUpsertRequest, PayoutInfoRequest, ProfileUpdateRequest, SignupRequest
from app.services import paystack as paystack_svc
from app.services.encryption import decrypt, encrypt
from app.services.notifications import notify_safe

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
    """A11: NIST 800-63B-style policy — length-first, no forced composition
    rules (they push users toward predictable substitutions like "P@ssw0rd1"
    without meaningfully raising entropy), a hard max length to prevent a
    huge input being pushed through scrypt (DoS), and a common/breached
    password blocklist instead.
    """
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters",
        )
    if len(password) > 128:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at most 128 characters",
        )
    if password.lower() in COMMON_PASSWORDS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This password is too common. Please choose a stronger password.",
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


def _decrypt_payout_info(payout_info: dict | None) -> dict:
    """G13: Decrypt payout_info blob.

    Payout info is stored as either:
    - ``{"__enc__": "<encrypted-json>"}`` (new encrypted format), or
    - plain dict (legacy unencrypted values).
    """
    if not payout_info:
        return {}
    if "__enc__" in payout_info:
        import json  # noqa: PLC0415
        raw = decrypt(payout_info["__enc__"])
        if raw:
            try:
                return json.loads(raw)
            except Exception:
                return {}
        return {}
    # Legacy plaintext payout_info — return as-is (G13: migrate on next save)
    return payout_info


def _serialize_profile(user: User) -> dict:
    shipping_info = user.shipping_info or {}
    payment_info = user.payment_info or {}
    store_location = user.store_location or {}
    seller_contact = user.seller_contact or {}
    seller_type = user.seller_type if user.seller_type in {"retail", "wholesale"} else "retail"
    seller_status = user.seller_status if user.seller_status in {
        "buyer",
        "incomplete",
        "pending_verification",
        "verified",
        "rejected",
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
        # G13: decrypt sensitive fields before returning to the caller.
        "governmentIdNumber": decrypt(user.government_id_number) or "",
        "governmentIdVerified": bool(user.government_id_verified),
        "sellerStartedAt": user.seller_started_at,
        "sellerIdentity": {
            "governmentIdType": user.government_id_type or "ghana-card",
            "governmentIdNumber": decrypt(user.government_id_number) or "",
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
        "payoutInfo": _decrypt_payout_info(user.payout_info),
        "niaVerifiedAt": user.nia_verified_at,
        "niaMatchConfidence": float(user.nia_match_confidence) if user.nia_match_confidence is not None else None,
        "onboardingStep": user.onboarding_step or 0,
        "rejectionReason": user.rejection_reason,
    }


def require_email_verified(db: Session, user_id: str | None, action: str) -> None:
    """A4: gate sensitive actions (checkout, seller onboarding, posting) on a
    verified email, without blocking sign-in/browsing entirely. Guests
    (user_id is None) are unaffected — this only gates signed-in users with
    an unverified account.
    """
    if not user_id:
        return
    user = db.get(User, user_id)
    if user is not None and not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Please verify your email before you can {action}.",
        )


# ---------------------------------------------------------------------------
# A5/A7: DB-backed login rate limiting — the old lib/rateLimit.ts on the Next
# side used a module-level Map, which resets on every Vercel cold start and
# is invisible to anyone calling this backend directly (bypassing the Next
# proxy entirely). Enforced here so neither escape hatch works. Keyed on
# email AND client IP: either exceeding the limit locks out the attempt, so
# an attacker can't dodge the per-email lockout by rotating IPs, nor spray
# many different emails from one IP without also tripping the IP key.
# ---------------------------------------------------------------------------

_LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5
_LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60


def _login_rate_limit_keys(email: str, client_ip: str) -> list[str]:
    return [f"login:email:{email.lower().strip()}", f"login:ip:{client_ip}"]


def check_login_rate_limit(db: Session, email: str, client_ip: str) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=_LOGIN_RATE_LIMIT_WINDOW_SECONDS)
    for key in _login_rate_limit_keys(email, client_ip):
        count = db.scalar(
            select(func.count(RateLimitEvent.id)).where(
                RateLimitEvent.key == key,
                RateLimitEvent.created_at > cutoff,
            )
        ) or 0
        if count >= _LOGIN_RATE_LIMIT_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many login attempts. Please try again later.",
                headers={"Retry-After": str(_LOGIN_RATE_LIMIT_WINDOW_SECONDS)},
            )


def record_login_failure(db: Session, email: str, client_ip: str) -> None:
    for key in _login_rate_limit_keys(email, client_ip):
        db.add(RateLimitEvent(id=f"rl-{uuid4().hex[:18]}", key=key))
    db.commit()


def clear_login_failures(db: Session, email: str, client_ip: str) -> None:
    for key in _login_rate_limit_keys(email, client_ip):
        db.execute(delete(RateLimitEvent).where(RateLimitEvent.key == key))
    db.commit()


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

    # G38: send welcome notification on registration.
    notify_safe(
        db,
        event_type="account",
        recipient_id=user.id,
        title=f"Welcome to Spree, {name.split()[0]}!",
        body=(
            "Your account has been created. Browse products, follow your favourite stores, "
            "and start shopping on Spree!"
        ),
        notif_type="account",
        href="/",
        email_subject="Welcome to Spree!",
        cta_label="Start shopping",
        cta_url=settings.frontend_url,
        recipient_email=user.email,
    )

    return _serialize_user(user)


def upsert_oauth_user(db: Session, req: OAuthUpsertRequest) -> dict:
    email = req.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))

    if user is not None:
        if user.oauth_provider:
            # Already linked to an OAuth provider from a prior sign-in — this
            # is a repeat login, not a new link. Never downgrade a previously
            # verified email based on a single unverified assertion.
            if req.email_verified:
                user.email_verified = True
            db.commit()
            db.refresh(user)
            return _serialize_user(user)

        # A3: first-time OAuth link against an *existing* account. Auto-linking
        # here is an account-takeover vector — an attacker who controls (or
        # can register) an OAuth account for the victim's email address would
        # otherwise gain access to the victim's password-protected account.
        # Only allow it when the provider itself asserts the email is
        # verified AND the account has no password to protect (i.e. nothing
        # for the attacker to take over).
        if not req.email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "This email is already registered but not verified with "
                    f"{req.provider}. Please sign in with your password instead."
                ),
            )
        if user.password_hash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "An account with this email already exists. "
                    "Please sign in with your password instead."
                ),
            )

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
        email_verified=bool(req.email_verified),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


def create_verification_token(db: Session, email: str) -> str:
    email = email.lower().strip()
    db.execute(
        delete(VerificationToken).where(
            VerificationToken.email == email,
            VerificationToken.purpose == "email_verification",
        )
    )
    token = secrets.token_urlsafe(32)
    vt = VerificationToken(
        id=uuid4().hex,
        email=email,
        token=token,
        purpose="email_verification",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(vt)
    db.commit()
    return token


def verify_email_token(db: Session, token: str) -> dict | None:
    vt = db.scalar(
        select(VerificationToken).where(
            VerificationToken.token == token,
            VerificationToken.purpose == "email_verification",
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


# ---------------------------------------------------------------------------
# A6: password reset — request (emailed short-expiry token) → confirm (set
# new password) → invalidate existing sessions. Reuses the VerificationToken
# table (purpose="password_reset", 1h expiry vs 24h for email verification)
# and the Resend-backed notify_safe/MANDATORY_EVENTS pattern used elsewhere.
# ---------------------------------------------------------------------------

_PASSWORD_RESET_TOKEN_TTL = timedelta(hours=1)


def request_password_reset(db: Session, email: str) -> None:
    """Always succeeds from the caller's perspective (no user-existence signal
    leaked) — if the email doesn't match an account, this is a silent no-op."""
    email = email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        return

    db.execute(
        delete(VerificationToken).where(
            VerificationToken.email == email,
            VerificationToken.purpose == "password_reset",
        )
    )
    token = secrets.token_urlsafe(32)
    vt = VerificationToken(
        id=uuid4().hex,
        email=email,
        token=token,
        purpose="password_reset",
        expires_at=datetime.now(timezone.utc) + _PASSWORD_RESET_TOKEN_TTL,
    )
    db.add(vt)
    db.commit()

    reset_url = f"{settings.frontend_url}/auth/reset-password?token={token}"
    notify_safe(
        db,
        event_type="password_reset",
        recipient_id=user.id,
        title="Reset your Spree password",
        # Channel-neutral wording — this body is shared verbatim between the
        # email and the in-app notification (notify_safe has no per-channel
        # body override); "ignore this email" read as a stray email fragment
        # when surfaced as an in-app notification.
        body="We received a request to reset your password. This link expires in 1 hour. "
        "If you didn't request this, you can safely ignore this notification.",
        notif_type="account",
        email_subject="Reset your Spree password",
        cta_label="Reset password",
        cta_url=reset_url,
        recipient_email=user.email,
    )


def reset_password_with_token(db: Session, token: str, new_password: str) -> bool:
    vt = db.scalar(
        select(VerificationToken).where(
            VerificationToken.token == token,
            VerificationToken.purpose == "password_reset",
            VerificationToken.expires_at > datetime.now(timezone.utc),
        )
    )
    if not vt:
        return False

    user = db.scalar(select(User).where(User.email == vt.email))
    if user is None:
        db.delete(vt)
        db.commit()
        return False

    _validate_password_strength(new_password)

    user.password_hash = hash_password(new_password)
    # A6/A10: bumping this invalidates every session issued before now — see
    # the sensitive-action revalidation check that compares a JWT's issued-at
    # claim against this timestamp.
    user.password_changed_at = datetime.now(timezone.utc)
    db.delete(vt)
    # One-time use: any other outstanding reset tokens for this email are
    # invalidated too, so an older leaked link can't be replayed afterward.
    db.execute(
        delete(VerificationToken).where(
            VerificationToken.email == vt.email,
            VerificationToken.purpose == "password_reset",
        )
    )
    db.commit()
    return True


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
                detail="That store handle is already taken by another vendor",
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
                detail="Please name your store before enabling vendor access",
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
                detail="Please provide a valid vendor business email",
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
    # G13: encrypt government ID number at rest.
    user.government_id_number = encrypt(government_id_number) if (wants_seller_access and government_id_number) else None
    user.shipping_info = payload.shippingAddress.model_dump()
    user.payment_info = payload.paymentInfo.model_dump()

    if wants_seller_access and user.seller_started_at is None:
        user.seller_started_at = datetime.now(timezone.utc)

    if user.role != "admin":
        if moderated_seller_status:
            user.role = "vendor"
        else:
            user.role = "vendor" if payload.isSeller else "customer"
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


def update_payout_info(db: Session, user_id: str, payload: "PayoutInfoRequest") -> dict:
    import json  # noqa: PLC0415

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # G13: store payout details as an encrypted JSON blob.
    payout_plain = {
        "method": payload.method,
        "mobileMoneyNetwork": payload.mobileMoneyNetwork or "",
        "mobileMoneyNumber": payload.mobileMoneyNumber or "",
        "bankCode": payload.bankCode or "",
        "bankName": payload.bankName or "",
        "accountNumber": payload.accountNumber or "",
        "currency": payload.currency or "GHS",
        "accountName": payload.accountName or "",
    }
    user.payout_info = {"__enc__": encrypt(json.dumps(payout_plain))}

    # Create or refresh the Paystack transfer recipient.
    if settings.paystack_secret_key:
        from app.services.orders import _MOMO_NETWORK_BANK_CODE  # noqa: PLC0415
        try:
            if payload.method == "mobile_money" and payload.mobileMoneyNumber:
                network = payload.mobileMoneyNetwork or ""
                bank_code = _MOMO_NETWORK_BANK_CODE.get(network) or _MOMO_NETWORK_BANK_CODE.get(network.lower(), "")
                if bank_code:
                    code = paystack_svc.create_transfer_recipient(
                        name=payload.accountName or user.name,
                        account_number=payload.mobileMoneyNumber,
                        mobile_money_network=bank_code,
                        currency=payload.currency or "GHS",
                    )
                    user.paystack_recipient_code = code
            elif payload.method == "bank" and payload.accountNumber and payload.bankCode:
                code = paystack_svc.create_transfer_recipient(
                    name=payload.accountName or user.name,
                    account_number=payload.accountNumber,
                    bank_code=payload.bankCode,
                    currency=payload.currency or "GHS",
                )
                user.paystack_recipient_code = code
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Could not register payout account with Paystack: {exc}",
            ) from exc

    db.add(user)
    db.commit()
    db.refresh(user)

    # Trigger immediate retry of any stuck payouts for this seller.
    if user.paystack_recipient_code:
        try:
            from app.services.orders import retry_stuck_payouts  # noqa: PLC0415
            retry_stuck_payouts(db)
        except Exception as exc:
            import logging as _logging  # noqa: PLC0415
            _logging.getLogger(__name__).warning("Payout retry after payout-info update failed: %s", exc)

    return _serialize_profile(user)

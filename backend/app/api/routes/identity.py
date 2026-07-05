"""Identity verification endpoints — NIA Ghana Card lookup + SmartSelfie face match.

Flow:
  1. POST /identity/lookup        — validate Ghana Card number, call NIA via Smile ID,
                                    show seller name/DOB/gender, create server-side session.
  2. GET  /identity/smileid-token — return Smile ID partner_id + HMAC signature so the
                                    @smile_id/smart-camera-web component can initialise
                                    without exposing the API key to the browser.
  3. POST /identity/face-verify   — receive SmartSelfie images, fetch NIA photo from
                                    session cache, call Smile ID face-compare, write audit
                                    log, auto-approve seller if confidence ≥ threshold.

Security notes:
  • NIA photo is held only in the server-side session; never sent to the browser.
  • Sessions expire after 30 minutes.
  • Sessions are deleted immediately after face-verify (pass or fail).
  • NIA lookup is rate-limited to 5 calls per user per hour.
  • Face-verify is locked after settings.smileid_max_attempts failed attempts.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import (
    ActorUserId,
    DBSession,
    InternalAPIKey,
    _check_rate_limit,
)
from app.core.config import settings
from app.db.models import User, VerificationAuditLog
from app.schemas.auth import (
    FaceVerifyRequest,
    FaceVerifyResponse,
    IdentityLookupRequest,
    IdentityLookupResponse,
)
from app.services.encryption import encrypt, hash_id_number
from app.services.face_match_adapter import face_match_adapter
from app.services.nia_adapter import nia_adapter
from app.services.verification_session import verification_sessions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/identity")


def _require_actor(actor_id: str | None) -> str:
    if not actor_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return actor_id


# ---------------------------------------------------------------------------
# 1. NIA lookup
# ---------------------------------------------------------------------------

@router.post("/lookup", response_model=IdentityLookupResponse)
async def lookup_ghana_card(
    body: IdentityLookupRequest,
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
) -> IdentityLookupResponse:
    """Step 1: look up a Ghana Card number via NIA / Smile ID.

    Returns the cardholder's name, DOB, and gender for the seller to confirm.
    The NIA mugshot is stored server-side in the session cache only.
    """
    user_id = _require_actor(actor_id)

    # Rate limit: 5 NIA lookups per user per hour.
    _check_rate_limit(f"nia_lookup:{user_id}", max_calls=5, window_seconds=3600)

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if user.verification_attempt_count >= settings.smileid_max_attempts:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Maximum verification attempts ({settings.smileid_max_attempts}) reached. "
                "Please contact support to continue."
            ),
        )

    # Check uniqueness before calling NIA — fast-fail if the card is already
    # verified on another active account.
    id_hash = hash_id_number(body.idNumber)
    duplicate = (
        db.query(User)
        .filter(
            User.government_id_hash == id_hash,
            User.government_id_verified.is_(True),
            User.deleted_at.is_(None),
            User.id != user_id,
        )
        .first()
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "This Ghana Card is already registered to a verified Spree account. "
                "Each card may only be used once. If you believe this is an error, "
                "please contact support."
            ),
        )

    result = await nia_adapter.verify(body.idNumber)

    if not result.success:
        if result.error_code == "INVALID_FORMAT":
            raise HTTPException(status_code=422, detail=result.error_message)
        if result.error_code == "NOT_FOUND":
            raise HTTPException(status_code=404, detail=result.error_message)
        if result.error_code in ("TIMEOUT", "NETWORK_ERROR", "PROVIDER_ERROR"):
            raise HTTPException(status_code=503, detail=result.error_message)
        raise HTTPException(status_code=422, detail=result.error_message)

    # Save encrypted Ghana Card number and its hash to user record.
    if not user.government_id_number:
        user.government_id_number = encrypt(body.idNumber)
        user.government_id_hash = id_hash
        db.commit()

    # Invalidate any existing sessions for this user before creating a new one.
    verification_sessions.invalidate_user_sessions(user_id)

    session_id = verification_sessions.create(
        user_id=user_id,
        id_number=body.idNumber,
        full_name=result.full_name,
        dob=result.dob,
        gender=result.gender,
        photo_b64=result.photo_b64,
    )

    return IdentityLookupResponse(
        sessionId=session_id,
        fullName=result.full_name,
        dob=result.dob,
        gender=result.gender,
        mock=result.mock,
    )


# ---------------------------------------------------------------------------
# 2. Smile ID SmartSelfie token
# ---------------------------------------------------------------------------

@router.get("/smileid-token")
async def get_smileid_token(
    _: InternalAPIKey,
    actor_id: ActorUserId,
) -> dict:
    """Return Smile ID partner credentials needed to initialise @smile_id/smart-camera-web.

    The HMAC signature is time-limited so the API key itself is never sent to
    the browser.
    """
    _require_actor(actor_id)

    if not settings.smileid_partner_id or not settings.smileid_api_key:
        # Return mock credentials for dev environments without Smile ID keys.
        return {
            "partnerId": "0",
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "signature": "mock-signature",
            "environment": "sandbox",
            "mock": True,
        }

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    msg = (timestamp + settings.smileid_partner_id).encode()
    sig = base64.b64encode(
        hmac.new(settings.smileid_api_key.encode(), msg, hashlib.sha256).digest()
    ).decode()

    return {
        "partnerId": settings.smileid_partner_id,
        "timestamp": timestamp,
        "signature": sig,
        "environment": settings.smileid_environment,
        "mock": False,
    }


# ---------------------------------------------------------------------------
# 3. Face verify
# ---------------------------------------------------------------------------

@router.post("/face-verify", response_model=FaceVerifyResponse)
async def face_verify(
    body: FaceVerifyRequest,
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
) -> FaceVerifyResponse:
    """Step 2: compare the live SmartSelfie against the NIA mugshot.

    On pass: sets government_id_verified=True, nia_verified_at, nia_match_confidence,
    seller_status→active, role→vendor. On fail: increments attempt_count; locks after max.
    Session is deleted from the cache regardless of outcome.
    """
    user_id = _require_actor(actor_id)

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if user.government_id_verified:
        return FaceVerifyResponse(
            verified=True,
            confidence=float(user.nia_match_confidence or 1.0),
            message="Identity already verified.",
        )

    if user.verification_attempt_count >= settings.smileid_max_attempts:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Maximum verification attempts ({settings.smileid_max_attempts}) reached. "
                "Please contact support to continue."
            ),
        )

    session = verification_sessions.get(body.sessionId)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Verification session not found or expired. Please restart the identity check.",
        )

    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Session does not belong to this user")

    # Race-condition guard: re-check uniqueness with the card from the session.
    id_hash = hash_id_number(session.id_number)
    duplicate = (
        db.query(User)
        .filter(
            User.government_id_hash == id_hash,
            User.government_id_verified.is_(True),
            User.deleted_at.is_(None),
            User.id != user_id,
        )
        .first()
    )
    if duplicate is not None:
        verification_sessions.delete(body.sessionId)
        raise HTTPException(
            status_code=409,
            detail=(
                "This Ghana Card has just been verified by another account. "
                "Each card may only be used once."
            ),
        )

    # Ensure hash is persisted (covers the edge case of a lookup before this
    # column existed, or a lookup that didn't commit the hash).
    if not user.government_id_hash:
        user.government_id_hash = id_hash
        db.commit()

    # Extract the selfie from the images list (image_type_id == 0).
    selfie_b64 = next(
        (img.image for img in body.images if img.image_type_id == 0),
        None,
    )
    if not selfie_b64:
        raise HTTPException(
            status_code=422,
            detail="No selfie image provided (image_type_id=0 is required)",
        )

    # Increment attempt count before calling the provider.
    attempt_number = verification_sessions.increment_attempt(body.sessionId)
    user.verification_attempt_count = (user.verification_attempt_count or 0) + 1
    db.commit()

    result = await face_match_adapter.verify(
        selfie_b64=selfie_b64,
        reference_b64=session.photo_b64,
    )

    # Determine outcome for the audit log.
    if result.error_code in ("TIMEOUT", "NETWORK_ERROR", "PARSE_ERROR"):
        outcome = "error"
    elif result.success:
        outcome = "pass"
    else:
        outcome = "fail"

    # Write audit log entry.
    audit = VerificationAuditLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        outcome=outcome,
        confidence_score=result.confidence_score or None,
        attempt_number=attempt_number,
        liveness_passed=result.liveness_passed,
        mock=result.mock,
        error_code=result.error_code or None,
    )
    db.add(audit)

    if outcome == "error":
        db.commit()
        # Delete session on provider error — seller can restart from lookup.
        verification_sessions.delete(body.sessionId)
        raise HTTPException(status_code=503, detail=result.error_message)

    if result.success:
        now = datetime.now(timezone.utc)
        user.government_id_verified = True
        user.nia_verified_at = now
        user.nia_match_confidence = result.confidence_score

        # Auto-approve: transition pending_verification → active.
        if user.seller_status in ("pending_verification", "incomplete"):
            user.seller_status = "active"
            user.role = "vendor"
            user.verified_at = now
            db.commit()
            _send_approval_notification(db, user)
        else:
            db.commit()

        # NIA photo and session are no longer needed — purge immediately.
        verification_sessions.delete(body.sessionId)

        return FaceVerifyResponse(
            verified=True,
            confidence=result.confidence_score,
            message="Identity verified successfully. Your account is now active.",
        )

    # Face match failed.
    db.commit()

    remaining = settings.smileid_max_attempts - user.verification_attempt_count
    if remaining <= 0:
        verification_sessions.delete(body.sessionId)
        raise HTTPException(
            status_code=403,
            detail=(
                f"Maximum verification attempts ({settings.smileid_max_attempts}) reached. "
                "Please contact support to continue."
            ),
        )

    return FaceVerifyResponse(
        verified=False,
        confidence=result.confidence_score,
        message=result.error_message or "Face match failed. Please try again.",
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _send_approval_notification(db: Session, user: User) -> None:
    try:
        from app.services import notifications as notif_svc  # noqa: PLC0415
        notif_svc.notify(
            db,
            event_type="seller_approved",
            recipient_id=user.id,
            title="Your vendor account is verified!",
            body=(
                "Congratulations! Your identity has been verified and your Spree vendor "
                "account is now active. You can start listing products."
            ),
            href="/dashboard/products/new",
            email_subject="Your Spree vendor account is approved",
            cta_label="Start selling",
        )
    except Exception:
        logger.exception("Failed to send approval notification to %s", user.id)

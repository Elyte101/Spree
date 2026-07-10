"""Passkey (WebAuthn) registration + authentication.

Registration requires an active session (adding a passkey to an existing
account). Authentication is usernameless/discoverable-credential based — the
platform authenticator surfaces any passkey registered for this site without
the caller ever sending an email up front, so there's no account-enumeration
surface on the "who is this" side of the ceremony.

Challenges are DB-backed (WebAuthnChallenge), not an in-memory dict — the
same fix applied to identity verification sessions (see
verification_session.py) for the same reason: Vercel serverless invocations
don't share process memory, so the browser's follow-up /verify call would
404 "challenge not found" as soon as it landed on a different invocation.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import webauthn
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url, options_to_json_dict
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import User, WebAuthnChallenge, WebAuthnCredential

logger = logging.getLogger(__name__)

_CHALLENGE_TTL_SECONDS = 5 * 60


def _rp_id() -> str:
    return settings.webauthn_rp_id


def _expected_origin() -> str:
    return settings.frontend_url.rstrip("/")


def _store_challenge(db: Session, *, challenge: bytes, purpose: str, user_id: str | None) -> str:
    challenge_id = f"waec-{uuid4().hex[:20]}"
    db.add(WebAuthnChallenge(
        id=challenge_id,
        user_id=user_id,
        challenge=bytes_to_base64url(challenge),
        purpose=purpose,
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=_CHALLENGE_TTL_SECONDS),
    ))
    db.commit()
    return challenge_id


def _consume_challenge(db: Session, challenge_id: str, *, purpose: str) -> WebAuthnChallenge:
    """Fetch + delete (one-time use) a still-valid challenge, or raise 400."""
    now = datetime.now(timezone.utc)
    row = db.scalar(
        select(WebAuthnChallenge).where(
            WebAuthnChallenge.id == challenge_id,
            WebAuthnChallenge.purpose == purpose,
            WebAuthnChallenge.expires_at > now,
        )
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This passkey request has expired. Please try again.",
        )
    db.delete(row)
    db.commit()
    return row


# ── Registration (caller must already be signed in) ───────────────────────

def generate_registration_options_for_user(db: Session, user_id: str) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing = db.scalars(
        select(WebAuthnCredential).where(WebAuthnCredential.user_id == user_id)
    ).all()
    exclude_credentials = [
        PublicKeyCredentialDescriptor(id=base64url_to_bytes(c.credential_id)) for c in existing
    ]

    options = webauthn.generate_registration_options(
        rp_id=_rp_id(),
        rp_name=settings.webauthn_rp_name,
        user_id=user_id.encode("utf-8"),
        user_name=user.email,
        user_display_name=user.name,
        exclude_credentials=exclude_credentials or None,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.REQUIRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
    )
    challenge_id = _store_challenge(
        db, challenge=options.challenge, purpose="registration", user_id=user_id
    )
    return {"options": options_to_json_dict(options), "challengeId": challenge_id}


def verify_registration(
    db: Session, user_id: str, challenge_id: str, credential: dict, device_name: str
) -> dict:
    challenge_row = _consume_challenge(db, challenge_id, purpose="registration")
    if challenge_row.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This passkey request does not belong to your session.",
        )

    try:
        verification = webauthn.verify_registration_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(challenge_row.challenge),
            expected_rp_id=_rp_id(),
            expected_origin=_expected_origin(),
        )
    except Exception as exc:
        logger.warning("webauthn registration verify failed for user %s: %s", user_id, exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not verify passkey. Please try again.",
        ) from exc

    cred_id_b64 = bytes_to_base64url(verification.credential_id)
    if db.scalar(select(WebAuthnCredential).where(WebAuthnCredential.credential_id == cred_id_b64)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This passkey is already registered.",
        )

    row = WebAuthnCredential(
        id=f"wacr-{uuid4().hex[:20]}",
        user_id=user_id,
        credential_id=cred_id_b64,
        public_key=bytes_to_base64url(verification.credential_public_key),
        sign_count=verification.sign_count,
        device_name=device_name.strip() or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "deviceName": row.device_name or "Passkey", "createdAt": row.created_at, "lastUsedAt": None}


# ── Authentication (usernameless — no session yet) ────────────────────────

def generate_authentication_options_usernameless(db: Session) -> dict:
    options = webauthn.generate_authentication_options(
        rp_id=_rp_id(),
        user_verification=UserVerificationRequirement.PREFERRED,
        # No allow_credentials — the platform authenticator surfaces any
        # discoverable credential registered for this RP, so the caller
        # never has to know/send an email up front (no enumeration signal).
    )
    challenge_id = _store_challenge(
        db, challenge=options.challenge, purpose="authentication", user_id=None
    )
    return {"options": options_to_json_dict(options), "challengeId": challenge_id}


def verify_authentication(db: Session, challenge_id: str, credential: dict) -> dict:
    from app.services.auth import _serialize_user  # noqa: PLC0415 — avoid circular import at module load

    challenge_row = _consume_challenge(db, challenge_id, purpose="authentication")

    raw_credential_id = credential.get("id") or credential.get("rawId")
    if not raw_credential_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid passkey response.")

    cred_row = db.scalar(
        select(WebAuthnCredential).where(WebAuthnCredential.credential_id == raw_credential_id)
    )
    if cred_row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This passkey is not registered with Spree.",
        )

    try:
        verification = webauthn.verify_authentication_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(challenge_row.challenge),
            expected_rp_id=_rp_id(),
            expected_origin=_expected_origin(),
            credential_public_key=base64url_to_bytes(cred_row.public_key),
            credential_current_sign_count=cred_row.sign_count,
        )
    except Exception as exc:
        logger.warning("webauthn authentication verify failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Passkey verification failed.",
        ) from exc

    cred_row.sign_count = verification.new_sign_count
    cred_row.last_used_at = datetime.now(timezone.utc)
    db.commit()

    user = db.get(User, cred_row.user_id)
    if user is None or user.deleted_at is not None or user.is_blacklisted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account is no longer active.",
        )

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return _serialize_user(user)


# ── Management ──────────────────────────────────────────────────────────

def list_credentials(db: Session, user_id: str) -> list[dict]:
    rows = db.scalars(
        select(WebAuthnCredential)
        .where(WebAuthnCredential.user_id == user_id)
        .order_by(WebAuthnCredential.created_at.desc())
    ).all()
    return [
        {
            "id": r.id,
            "deviceName": r.device_name or "Passkey",
            "createdAt": r.created_at,
            "lastUsedAt": r.last_used_at,
        }
        for r in rows
    ]


def delete_credential(db: Session, user_id: str, credential_id: str) -> None:
    row = db.get(WebAuthnCredential, credential_id)
    if row is None or row.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Passkey not found")
    db.delete(row)
    db.commit()

"""Passkey (WebAuthn) endpoints.

Registration (add a passkey to the currently signed-in account):
  1. POST /auth/webauthn/register/options — actor-authenticated
  2. POST /auth/webauthn/register/verify  — actor-authenticated

Authentication (usernameless — sign in with a passkey, no session yet):
  1. POST /auth/webauthn/authenticate/options — public
  2. POST /auth/webauthn/authenticate/verify  — public, returns the same
     {id, name, email, role, email_verified} shape as POST /auth/login so
     the frontend's NextAuth "webauthn" Credentials provider can turn it
     into a session exactly like the password provider does.

Management:
  GET    /auth/webauthn/credentials      — actor-authenticated, list own
  DELETE /auth/webauthn/credentials/{id} — actor-authenticated, remove own
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, status

from app.api.deps import ActorUserId, DBSession, InternalAPIKey, _check_rate_limit
from app.schemas.webauthn import (
    WebAuthnAuthenticationVerifyIn,
    WebAuthnCredentialOut,
    WebAuthnOptionsOut,
    WebAuthnRegistrationVerifyIn,
)
from app.services import webauthn_svc

router = APIRouter(prefix="/auth/webauthn")


def _require_actor(actor_id: str | None) -> str:
    if not actor_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return actor_id


@router.post("/register/options", response_model=WebAuthnOptionsOut)
def register_options(db: DBSession, _: InternalAPIKey, actor_id: ActorUserId):
    user_id = _require_actor(actor_id)
    return webauthn_svc.generate_registration_options_for_user(db, user_id)


@router.post("/register/verify", response_model=WebAuthnCredentialOut)
def register_verify(payload: WebAuthnRegistrationVerifyIn, db: DBSession, _: InternalAPIKey, actor_id: ActorUserId):
    user_id = _require_actor(actor_id)
    return webauthn_svc.verify_registration(
        db, user_id, payload.challengeId, payload.credential, payload.deviceName
    )


@router.post("/authenticate/options", response_model=WebAuthnOptionsOut)
def authenticate_options(
    db: DBSession,
    _: InternalAPIKey,
    x_client_ip: Annotated[str | None, Header(alias="X-Client-Ip")] = None,
):
    # Light abuse-prevention — same key style as login's rate limiter (A5/A7)
    # — this endpoint is unauthenticated by design (usernameless), so it's
    # the one passkey route reachable by anyone with just the internal key.
    _check_rate_limit(db, f"webauthn_auth_options:{x_client_ip or 'unknown'}", max_calls=20, window_seconds=300)
    return webauthn_svc.generate_authentication_options_usernameless(db)


@router.post("/authenticate/verify")
def authenticate_verify(
    payload: WebAuthnAuthenticationVerifyIn,
    db: DBSession,
    _: InternalAPIKey,
    x_client_ip: Annotated[str | None, Header(alias="X-Client-Ip")] = None,
):
    _check_rate_limit(db, f"webauthn_auth_verify:{x_client_ip or 'unknown'}", max_calls=20, window_seconds=300)
    return webauthn_svc.verify_authentication(db, payload.challengeId, payload.credential)


@router.get("/credentials", response_model=list[WebAuthnCredentialOut])
def list_credentials(db: DBSession, _: InternalAPIKey, actor_id: ActorUserId):
    user_id = _require_actor(actor_id)
    return webauthn_svc.list_credentials(db, user_id)


@router.delete("/credentials/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_credential(credential_id: str, db: DBSession, _: InternalAPIKey, actor_id: ActorUserId):
    user_id = _require_actor(actor_id)
    webauthn_svc.delete_credential(db, user_id, credential_id)

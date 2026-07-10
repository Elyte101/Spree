"""Passkey (WebAuthn) tests.

The actual signed registration/authentication ceremony (real ECDSA
attestation/assertion) is proven end-to-end with a real browser + Playwright's
virtual authenticator in e2e/passkey.spec.ts — replicating that crypto by
hand here would just re-implement (and risk subtly diverging from) a
software authenticator. These tests cover everything else: challenge
issuance/expiry/one-time-use, and the auth-required/not-found/duplicate
error paths.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

_env_path = Path(__file__).resolve().parents[1] / ".env"
if _env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_path, override=False)

from fastapi.testclient import TestClient

from app.main import app
from conftest import actor_token

INTERNAL_KEY = os.environ.get("BACKEND_INTERNAL_API_KEY", "spree-internal-dev-key")
INTERNAL_HEADERS = {"X-Internal-Api-Key": INTERNAL_KEY}


def _signup(client) -> str:
    email = f"passkey-{uuid4().hex[:8]}@test.com"
    resp = client.post(
        "/api/v1/auth/signup",
        headers=INTERNAL_HEADERS,
        json={"name": "Passkey Tester", "email": email, "password": "PasskeyPass123!"},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def test_register_options_requires_auth():
    with TestClient(app) as client:
        resp = client.post("/api/v1/auth/webauthn/register/options", headers=INTERNAL_HEADERS)
        assert resp.status_code == 401


def test_register_options_returns_challenge_and_discoverable_credential_config():
    with TestClient(app) as client:
        uid = _signup(client)
        resp = client.post(
            "/api/v1/auth/webauthn/register/options",
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token(uid)},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["challengeId"]
        assert body["options"]["challenge"]
        assert body["options"]["user"]["id"]
        # residentKey="required" is what makes authentication usernameless.
        assert body["options"]["authenticatorSelection"]["residentKey"] == "required"


def test_authenticate_options_is_public_and_usernameless():
    with TestClient(app) as client:
        resp = client.post("/api/v1/auth/webauthn/authenticate/options", headers=INTERNAL_HEADERS)
        assert resp.status_code == 200
        body = resp.json()
        assert body["challengeId"]
        assert body["options"]["challenge"]
        # No allowCredentials — the whole point is not needing to know who's
        # signing in before the browser resolves a credential.
        assert not body["options"].get("allowCredentials")


def test_authenticate_options_requires_internal_key():
    with TestClient(app) as client:
        resp = client.post("/api/v1/auth/webauthn/authenticate/options")
        assert resp.status_code == 401


def test_register_verify_rejects_expired_challenge():
    from app.db.session import SessionLocal
    from app.db.models import WebAuthnChallenge

    with TestClient(app) as client:
        uid = _signup(client)

        expired_id = f"waec-{uuid4().hex[:20]}"
        with SessionLocal() as db:
            db.add(WebAuthnChallenge(
                id=expired_id,
                user_id=uid,
                challenge="ZmFrZS1jaGFsbGVuZ2U",
                purpose="registration",
                expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),
            ))
            db.commit()

        resp = client.post(
            "/api/v1/auth/webauthn/register/verify",
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token(uid)},
            json={"challengeId": expired_id, "credential": {"id": "x"}, "deviceName": "Test device"},
        )
        assert resp.status_code == 400


def test_register_verify_rejects_challenge_belonging_to_another_user():
    from app.db.session import SessionLocal
    from app.db.models import WebAuthnChallenge

    with TestClient(app) as client:
        uid_a = _signup(client)
        uid_b = _signup(client)

        challenge_id = f"waec-{uuid4().hex[:20]}"
        with SessionLocal() as db:
            db.add(WebAuthnChallenge(
                id=challenge_id,
                user_id=uid_a,
                challenge="ZmFrZS1jaGFsbGVuZ2U",
                purpose="registration",
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            ))
            db.commit()

        # uid_b tries to redeem a challenge that was minted for uid_a.
        resp = client.post(
            "/api/v1/auth/webauthn/register/verify",
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token(uid_b)},
            json={"challengeId": challenge_id, "credential": {"id": "x"}, "deviceName": "Test device"},
        )
        assert resp.status_code == 400


def test_authenticate_verify_rejects_unregistered_credential():
    from app.db.session import SessionLocal
    from app.db.models import WebAuthnChallenge

    with TestClient(app) as client:
        challenge_id = f"waec-{uuid4().hex[:20]}"
        with SessionLocal() as db:
            db.add(WebAuthnChallenge(
                id=challenge_id,
                user_id=None,
                challenge="ZmFrZS1jaGFsbGVuZ2U",
                purpose="authentication",
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            ))
            db.commit()

        resp = client.post(
            "/api/v1/auth/webauthn/authenticate/verify",
            headers=INTERNAL_HEADERS,
            json={"challengeId": challenge_id, "credential": {"id": "nonexistent-credential-id"}},
        )
        assert resp.status_code == 401


def test_challenge_is_single_use():
    """A registration challenge must not be redeemable twice, even if the
    second attempt also fails verification for other reasons — the
    challenge row itself is consumed (deleted) on first use."""
    from app.db.session import SessionLocal
    from app.db.models import WebAuthnChallenge

    with TestClient(app) as client:
        uid = _signup(client)
        challenge_id = f"waec-{uuid4().hex[:20]}"
        with SessionLocal() as db:
            db.add(WebAuthnChallenge(
                id=challenge_id,
                user_id=uid,
                challenge="ZmFrZS1jaGFsbGVuZ2U",
                purpose="registration",
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
            ))
            db.commit()

        headers = {**INTERNAL_HEADERS, "X-Actor-Token": actor_token(uid)}
        first = client.post(
            "/api/v1/auth/webauthn/register/verify",
            headers=headers,
            json={"challengeId": challenge_id, "credential": {"id": "x"}, "deviceName": ""},
        )
        # Fails verification (garbage credential) — but consumes the challenge.
        assert first.status_code == 400

        second = client.post(
            "/api/v1/auth/webauthn/register/verify",
            headers=headers,
            json={"challengeId": challenge_id, "credential": {"id": "x"}, "deviceName": ""},
        )
        assert second.status_code == 400
        assert "expired" in second.json()["detail"].lower()


def test_list_and_delete_credentials_requires_auth():
    with TestClient(app) as client:
        assert client.get("/api/v1/auth/webauthn/credentials", headers=INTERNAL_HEADERS).status_code == 401
        assert client.delete("/api/v1/auth/webauthn/credentials/abc", headers=INTERNAL_HEADERS).status_code == 401


def test_list_credentials_empty_for_new_user():
    with TestClient(app) as client:
        uid = _signup(client)
        resp = client.get(
            "/api/v1/auth/webauthn/credentials",
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token(uid)},
        )
        assert resp.status_code == 200
        assert resp.json() == []


def test_delete_credential_denies_cross_user_access():
    from app.db.session import SessionLocal
    from app.db.models import WebAuthnCredential

    with TestClient(app) as client:
        owner = _signup(client)
        other = _signup(client)

        cred_id = f"wacr-{uuid4().hex[:20]}"
        with SessionLocal() as db:
            db.add(WebAuthnCredential(
                id=cred_id,
                user_id=owner,
                credential_id=f"cred-{uuid4().hex[:16]}",
                public_key="ZmFrZS1rZXk",
                sign_count=0,
            ))
            db.commit()

        resp = client.delete(
            f"/api/v1/auth/webauthn/credentials/{cred_id}",
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token(other)},
        )
        assert resp.status_code == 404

        # Owner can delete their own.
        resp = client.delete(
            f"/api/v1/auth/webauthn/credentials/{cred_id}",
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token(owner)},
        )
        assert resp.status_code == 204

"""Passkey (WebAuthn) tests.

Real browser ceremonies (actual platform authenticator UI, actual
attestation) are proven end-to-end with a real browser + Playwright's
virtual authenticator in e2e/passkey.spec.ts. Here, `FakeAuthenticator`
below plays the role of a software authenticator using real ECDSA
signatures (P-256/ES256, "none" attestation format) so the actual
py_webauthn verification path — CBOR parsing, COSE key decoding, signature
verification, sign-count tracking — is exercised for real, not mocked. The
rest of the suite covers challenge issuance/expiry/one-time-use and the
auth-required/not-found/duplicate error paths with garbage credentials
(cheaper, and verification never gets far enough to touch the signature).
"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

_env_path = Path(__file__).resolve().parents[1] / ".env"
if _env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_path, override=False)

import cbor2
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app.main import app
from app.services.webauthn_svc import _expected_origin, _rp_id
from conftest import actor_token

INTERNAL_KEY = os.environ.get("BACKEND_INTERNAL_API_KEY", "spree-internal-dev-key")
INTERNAL_HEADERS = {"X-Internal-Api-Key": INTERNAL_KEY}


class FakeAuthenticator:
    """A minimal software WebAuthn authenticator: real P-256 keypair, real
    ECDSA signatures, "none" attestation. Stands in for a browser + platform
    authenticator so `webauthn.verify_registration_response`/
    `verify_authentication_response` run their real verification logic
    against real credentials instead of garbage payloads."""

    def __init__(self):
        self.rp_id = _rp_id()
        self.origin = _expected_origin()
        self.private_key = ec.generate_private_key(ec.SECP256R1())
        self.credential_id = os.urandom(16)
        self.sign_count = 0

    def _rp_id_hash(self) -> bytes:
        return hashlib.sha256(self.rp_id.encode("utf-8")).digest()

    def create_credential(self, challenge_b64url: str) -> dict:
        from webauthn.helpers import bytes_to_base64url

        pub_numbers = self.private_key.public_key().public_numbers()
        cose_key = cbor2.dumps({
            1: 2,  # kty: EC2
            3: -7,  # alg: ES256
            -1: 1,  # crv: P-256
            -2: pub_numbers.x.to_bytes(32, "big"),
            -3: pub_numbers.y.to_bytes(32, "big"),
        })

        flags = 0b01000001  # UP (bit0) + attested credential data present (bit6)
        auth_data = (
            self._rp_id_hash()
            + bytes([flags])
            + (0).to_bytes(4, "big")  # signCount — 0 at registration
            + (b"\x00" * 16)  # aaguid
            + len(self.credential_id).to_bytes(2, "big")
            + self.credential_id
            + cose_key
        )
        attestation_object = cbor2.dumps({"fmt": "none", "attStmt": {}, "authData": auth_data})
        client_data = json.dumps({
            "type": "webauthn.create",
            "challenge": challenge_b64url,
            "origin": self.origin,
            "crossOrigin": False,
        }).encode("utf-8")

        return {
            "id": bytes_to_base64url(self.credential_id),
            "rawId": bytes_to_base64url(self.credential_id),
            "response": {
                "clientDataJSON": bytes_to_base64url(client_data),
                "attestationObject": bytes_to_base64url(attestation_object),
            },
            "type": "public-key",
        }

    def get_assertion(self, challenge_b64url: str) -> dict:
        from webauthn.helpers import bytes_to_base64url

        self.sign_count += 1
        flags = 0b00000001  # UP only
        auth_data = self._rp_id_hash() + bytes([flags]) + self.sign_count.to_bytes(4, "big")
        client_data = json.dumps({
            "type": "webauthn.get",
            "challenge": challenge_b64url,
            "origin": self.origin,
            "crossOrigin": False,
        }).encode("utf-8")
        signature = self.private_key.sign(
            auth_data + hashlib.sha256(client_data).digest(), ec.ECDSA(hashes.SHA256())
        )

        return {
            "id": bytes_to_base64url(self.credential_id),
            "rawId": bytes_to_base64url(self.credential_id),
            "response": {
                "clientDataJSON": bytes_to_base64url(client_data),
                "authenticatorData": bytes_to_base64url(auth_data),
                "signature": bytes_to_base64url(signature),
            },
            "type": "public-key",
        }


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


def _register_real_credential(client, uid: str) -> FakeAuthenticator:
    headers = {**INTERNAL_HEADERS, "X-Actor-Token": actor_token(uid)}
    options_resp = client.post("/api/v1/auth/webauthn/register/options", headers=headers)
    assert options_resp.status_code == 200
    body = options_resp.json()

    authenticator = FakeAuthenticator()
    credential = authenticator.create_credential(body["options"]["challenge"])

    verify_resp = client.post(
        "/api/v1/auth/webauthn/register/verify",
        headers=headers,
        json={"challengeId": body["challengeId"], "credential": credential, "deviceName": "Test device"},
    )
    assert verify_resp.status_code == 200, verify_resp.text
    return authenticator


def test_register_verify_persists_a_real_credential():
    from app.db.session import SessionLocal
    from app.db.models import WebAuthnCredential
    from webauthn.helpers import bytes_to_base64url

    with TestClient(app) as client:
        uid = _signup(client)
        authenticator = _register_real_credential(client, uid)

        with SessionLocal() as db:
            row = db.query(WebAuthnCredential).filter_by(user_id=uid).one()
            assert row.credential_id == bytes_to_base64url(authenticator.credential_id)
            assert row.sign_count == 0
            assert row.device_name == "Test device"
            assert row.public_key


def test_authenticate_verify_succeeds_and_increments_sign_count():
    from app.db.session import SessionLocal
    from app.db.models import WebAuthnCredential

    with TestClient(app) as client:
        uid = _signup(client)
        authenticator = _register_real_credential(client, uid)

        options_resp = client.post("/api/v1/auth/webauthn/authenticate/options", headers=INTERNAL_HEADERS)
        assert options_resp.status_code == 200
        body = options_resp.json()

        assertion = authenticator.get_assertion(body["options"]["challenge"])
        auth_resp = client.post(
            "/api/v1/auth/webauthn/authenticate/verify",
            headers=INTERNAL_HEADERS,
            json={"challengeId": body["challengeId"], "credential": assertion},
        )
        assert auth_resp.status_code == 200, auth_resp.text
        # Same shape /auth/login returns — what the frontend's "passkey"
        # NextAuth Credentials provider turns into a session.
        user_payload = auth_resp.json()
        assert user_payload["id"] == uid
        assert user_payload["role"] == "customer"

        with SessionLocal() as db:
            row = db.query(WebAuthnCredential).filter_by(user_id=uid).one()
            assert row.sign_count == 1
            assert row.last_used_at is not None


def test_authenticate_verify_rejects_a_replayed_challenge_even_with_a_valid_signature():
    """The exact same signed assertion, resubmitted against the same
    challengeId a second time, must be rejected — proving replay protection
    holds even when the signature itself is genuinely valid (unlike the
    garbage-credential replay test above, which never reaches signature
    verification)."""
    with TestClient(app) as client:
        uid = _signup(client)
        authenticator = _register_real_credential(client, uid)

        options_resp = client.post("/api/v1/auth/webauthn/authenticate/options", headers=INTERNAL_HEADERS)
        body = options_resp.json()
        assertion = authenticator.get_assertion(body["options"]["challenge"])
        payload = {"challengeId": body["challengeId"], "credential": assertion}

        first = client.post("/api/v1/auth/webauthn/authenticate/verify", headers=INTERNAL_HEADERS, json=payload)
        assert first.status_code == 200

        replay = client.post("/api/v1/auth/webauthn/authenticate/verify", headers=INTERNAL_HEADERS, json=payload)
        assert replay.status_code == 400
        assert "expired" in replay.json()["detail"].lower()

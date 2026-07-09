"""Tests for the identity verification flow (NIA lookup + face verify).

All tests run against the real FastAPI app with an in-memory SQLite database
so no external services are called (Smile ID calls go through MockProvider /
MockFaceProvider because SMILEID_PARTNER_ID is not set in test env).

Conventions match test_api.py: load .env once, use TestClient, INTERNAL_HEADERS.
"""
from __future__ import annotations

import os
from pathlib import Path
from uuid import uuid4

from unittest.mock import AsyncMock, patch

# Mirror test_api.py: load .env so INTERNAL_KEY matches Settings.
_env_path = Path(__file__).resolve().parents[1] / ".env"
if _env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_path, override=False)

from fastapi.testclient import TestClient

from app.main import app
from conftest import actor_token

INTERNAL_KEY = os.environ.get("BACKEND_INTERNAL_API_KEY", "spree-internal-dev-key")
INTERNAL_HEADERS = {"X-Internal-Api-Key": INTERNAL_KEY}


def _actor_headers(user_id: str) -> dict:
    # A2: actor identity is proven with a signed token now, not a raw
    # X-Actor-User-Id header — see conftest.actor_token.
    return {**INTERNAL_HEADERS, "X-Actor-Token": actor_token(user_id)}


def _register_user(client: TestClient) -> str:
    """Register a fresh user and return their user_id."""
    email = f"nia-test-{uuid4().hex[:8]}@spree.test"
    resp = client.post(
        "/api/v1/auth/signup",
        json={"name": "NIA Tester", "email": email, "password": "Password123!"},
        headers=INTERNAL_HEADERS,
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["id"]


# ---------------------------------------------------------------------------
# NIA Lookup
# ---------------------------------------------------------------------------

def test_lookup_invalid_format_returns_422():
    with TestClient(app) as client:
        user_id = _register_user(client)
        resp = client.post(
            "/api/v1/identity/lookup",
            json={"idNumber": "INVALID-NUMBER"},
            headers=_actor_headers(user_id),
        )
    assert resp.status_code == 422
    assert "format" in resp.json()["detail"].lower()


def test_lookup_not_found_returns_404():
    """Mock ends in '0' → NOT_FOUND in MockProvider."""
    with TestClient(app) as client:
        user_id = _register_user(client)
        resp = client.post(
            "/api/v1/identity/lookup",
            json={"idNumber": "GHA-000000000-0"},
            headers=_actor_headers(user_id),
        )
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_lookup_provider_down_returns_503():
    """Mock ends in '9' → TIMEOUT in MockProvider."""
    with TestClient(app) as client:
        user_id = _register_user(client)
        resp = client.post(
            "/api/v1/identity/lookup",
            json={"idNumber": "GHA-000000009-9"},
            headers=_actor_headers(user_id),
        )
    assert resp.status_code == 503


def test_lookup_success_returns_session_and_name():
    """Mock ends in '1' → synthetic success in MockProvider."""
    with TestClient(app) as client:
        user_id = _register_user(client)
        resp = client.post(
            "/api/v1/identity/lookup",
            json={"idNumber": "GHA-000000001-1"},
            headers=_actor_headers(user_id),
        )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "sessionId" in data
    assert data["fullName"] == "KWAME MENSAH"
    assert data["mock"] is True


def test_lookup_requires_auth():
    """Missing X-Actor-User-Id should return 401."""
    with TestClient(app) as client:
        resp = client.post(
            "/api/v1/identity/lookup",
            json={"idNumber": "GHA-000000001-1"},
            headers=INTERNAL_HEADERS,
        )
    assert resp.status_code == 401


def test_lookup_requires_internal_key():
    """Missing X-Internal-Api-Key should return 401."""
    with TestClient(app) as client:
        resp = client.post(
            "/api/v1/identity/lookup",
            json={"idNumber": "GHA-000000001-1"},
            headers={"X-Actor-User-Id": "some-user"},
        )
    assert resp.status_code == 401


def test_lookup_rate_limited():
    """Calling lookup 6× within an hour should return 429 on the 6th call."""
    with TestClient(app) as client:
        user_id = _register_user(client)
        headers = _actor_headers(user_id)
        for i in range(5):
            client.post(
                "/api/v1/identity/lookup",
                json={"idNumber": f"GHA-00000000{i}-{i}"},
                headers=headers,
            )
        # 6th call should be rate-limited.
        resp = client.post(
            "/api/v1/identity/lookup",
            json={"idNumber": "GHA-000000005-5"},
            headers=headers,
        )
    assert resp.status_code == 429


# ---------------------------------------------------------------------------
# Smile ID token
# ---------------------------------------------------------------------------

def test_smileid_token_returns_mock_when_no_credentials():
    with TestClient(app) as client:
        user_id = _register_user(client)
        resp = client.get(
            "/api/v1/identity/smileid-token",
            headers=_actor_headers(user_id),
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["mock"] is True
    assert "partnerId" in data
    assert "signature" in data


# ---------------------------------------------------------------------------
# Face verify
# ---------------------------------------------------------------------------

def _fake_selfie() -> str:
    """Return a minimal base64 string representing a selfie."""
    return "ZmFrZS1zZWxmaWU="  # b"fake-selfie" in base64


def test_face_verify_pass_sets_government_id_verified():
    """Happy path: mock face match passes → user.government_id_verified=True."""
    with TestClient(app) as client:
        user_id = _register_user(client)

        # Step 1: lookup
        lookup_resp = client.post(
            "/api/v1/identity/lookup",
            json={"idNumber": "GHA-000000001-1"},
            headers=_actor_headers(user_id),
        )
        assert lookup_resp.status_code == 200, lookup_resp.text
        session_id = lookup_resp.json()["sessionId"]

        # Step 2: face verify
        resp = client.post(
            "/api/v1/identity/face-verify",
            json={
                "sessionId": session_id,
                "images": [{"image_type_id": 0, "image": _fake_selfie()}],
            },
            headers=_actor_headers(user_id),
        )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["verified"] is True
    assert data["confidence"] > 0


def test_face_verify_low_confidence_returns_unverified():
    """FACE_MATCH_MOCK_FAIL → face match fails → verified=False."""
    with TestClient(app) as client:
        user_id = _register_user(client)

        lookup_resp = client.post(
            "/api/v1/identity/lookup",
            json={"idNumber": "GHA-000000002-2"},
            headers=_actor_headers(user_id),
        )
        assert lookup_resp.status_code == 200
        session_id = lookup_resp.json()["sessionId"]

        with patch.dict(os.environ, {"FACE_MATCH_MOCK_FAIL": "true"}):
            resp = client.post(
                "/api/v1/identity/face-verify",
                json={
                    "sessionId": session_id,
                    "images": [{"image_type_id": 0, "image": _fake_selfie()}],
                },
                headers=_actor_headers(user_id),
            )
    assert resp.status_code == 200
    data = resp.json()
    assert data["verified"] is False


def test_face_verify_liveness_fail_returns_unverified():
    """FACE_MATCH_MOCK_LIVENESS_FAIL → liveness fails → verified=False."""
    with TestClient(app) as client:
        user_id = _register_user(client)

        lookup_resp = client.post(
            "/api/v1/identity/lookup",
            json={"idNumber": "GHA-000000003-3"},
            headers=_actor_headers(user_id),
        )
        assert lookup_resp.status_code == 200
        session_id = lookup_resp.json()["sessionId"]

        with patch.dict(os.environ, {"FACE_MATCH_MOCK_LIVENESS_FAIL": "true"}):
            resp = client.post(
                "/api/v1/identity/face-verify",
                json={
                    "sessionId": session_id,
                    "images": [{"image_type_id": 0, "image": _fake_selfie()}],
                },
                headers=_actor_headers(user_id),
            )
    assert resp.status_code == 200
    assert resp.json()["verified"] is False


def test_face_verify_max_attempts_returns_403():
    """After smileid_max_attempts failures, further attempts return 403."""
    with TestClient(app) as client:
        user_id = _register_user(client)

        with patch.dict(os.environ, {"FACE_MATCH_MOCK_FAIL": "true"}):
            for _ in range(3):
                lookup_resp = client.post(
                    "/api/v1/identity/lookup",
                    json={"idNumber": "GHA-000000004-4"},
                    headers=_actor_headers(user_id),
                )
                if lookup_resp.status_code == 403:
                    break
                session_id = lookup_resp.json()["sessionId"]
                client.post(
                    "/api/v1/identity/face-verify",
                    json={
                        "sessionId": session_id,
                        "images": [{"image_type_id": 0, "image": _fake_selfie()}],
                    },
                    headers=_actor_headers(user_id),
                )

            # After max attempts, any new lookup should return 403.
            resp = client.post(
                "/api/v1/identity/lookup",
                json={"idNumber": "GHA-000000004-4"},
                headers=_actor_headers(user_id),
            )
    assert resp.status_code == 403


def test_face_verify_expired_session_returns_404():
    """Submitting a non-existent session_id returns 404."""
    with TestClient(app) as client:
        user_id = _register_user(client)
        resp = client.post(
            "/api/v1/identity/face-verify",
            json={
                "sessionId": str(uuid4()),
                "images": [{"image_type_id": 0, "image": _fake_selfie()}],
            },
            headers=_actor_headers(user_id),
        )
    assert resp.status_code == 404


def test_face_verify_missing_selfie_returns_422():
    """Sending images without image_type_id=0 should fail validation."""
    with TestClient(app) as client:
        user_id = _register_user(client)

        lookup_resp = client.post(
            "/api/v1/identity/lookup",
            json={"idNumber": "GHA-000000005-5"},
            headers=_actor_headers(user_id),
        )
        assert lookup_resp.status_code == 200
        session_id = lookup_resp.json()["sessionId"]

        resp = client.post(
            "/api/v1/identity/face-verify",
            json={
                "sessionId": session_id,
                "images": [],  # no selfie
            },
            headers=_actor_headers(user_id),
        )
    assert resp.status_code == 422


def test_lookup_card_already_verified_on_another_account_returns_409():
    """A Ghana Card verified by user A cannot be looked up by user B."""
    with TestClient(app) as client:
        user_a = _register_user(client)
        user_b = _register_user(client)

        # User A: full happy-path verification.
        lookup_resp = client.post(
            "/api/v1/identity/lookup",
            json={"idNumber": "GHA-000000006-6"},
            headers=_actor_headers(user_a),
        )
        assert lookup_resp.status_code == 200, lookup_resp.text
        session_id = lookup_resp.json()["sessionId"]

        verify_resp = client.post(
            "/api/v1/identity/face-verify",
            json={
                "sessionId": session_id,
                "images": [{"image_type_id": 0, "image": _fake_selfie()}],
            },
            headers=_actor_headers(user_a),
        )
        assert verify_resp.status_code == 200
        assert verify_resp.json()["verified"] is True

        # User B: same card should now be rejected.
        conflict_resp = client.post(
            "/api/v1/identity/lookup",
            json={"idNumber": "GHA-000000006-6"},
            headers=_actor_headers(user_b),
        )
    assert conflict_resp.status_code == 409
    assert "already registered" in conflict_resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Old id-documents endpoint — removed
# ---------------------------------------------------------------------------

def test_old_id_documents_endpoint_is_gone():
    """Verify the old file-upload endpoint no longer exists."""
    with TestClient(app) as client:
        resp = client.post(
            "/api/v1/auth/profile/some-user-id/id-documents",
        )
    assert resp.status_code == 404

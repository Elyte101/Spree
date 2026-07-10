import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

# Load the backend .env file so that INTERNAL_KEY matches the running Settings
# instance (which pydantic-settings loads from the same file).
_env_path = Path(__file__).resolve().parents[1] / ".env"
if _env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_path, override=False)

from fastapi.testclient import TestClient

from app.main import app
from conftest import actor_token

INTERNAL_KEY = os.environ.get("BACKEND_INTERNAL_API_KEY", "spree-internal-dev-key")
INTERNAL_HEADERS = {"X-Internal-Api-Key": INTERNAL_KEY}
# A2: actor identity is now proven with a signed token, not raw X-Actor-*
# headers — see conftest.actor_token. "user-admin" is the seeded admin user
# (app/db/init_db.py), so this also satisfies routes that look the actor up
# in the DB, not just ones that only check the role claim.
ADMIN_HEADERS = {
    "X-Internal-Api-Key": INTERNAL_KEY,
    "X-Actor-Token": actor_token("user-admin", "admin"),
}


# ---------------------------------------------------------------------------
# Shared helpers for payment regression tests
# ---------------------------------------------------------------------------

def _create_paid_order_in_db() -> dict:
    """Directly insert a paid Order row into the DB — bypasses Paystack entirely.
    Returns {orderId, reference}.  Safe for tests that target post-payment logic
    (refunds, auto-release) and don't care about the payment initialisation path."""
    from decimal import Decimal
    from app.db.session import SessionLocal
    from app.db.models import Order, OrderItem

    order_id = f"order-test-{uuid4().hex[:12]}"
    reference = f"spree-test-ref-{uuid4().hex[:8]}"

    with SessionLocal() as db:
        order = Order(
            id=order_id,
            status="paid",
            full_name="Test Buyer",
            email=f"buyer-{uuid4().hex[:6]}@test.com",
            address_line1="1 Test Street",
            city="Accra",
            state="Greater Accra",
            postal_code="00233",
            country="Ghana",
            shipping_method="standard",
            payment_method="card",
            subtotal=Decimal("200.00"),
            shipping_cost=Decimal("12.00"),
            tax=Decimal("3.00"),
            total=Decimal("215.00"),
            currency="GHS",
            paystack_reference=reference,
        )
        db.add(order)
        db.add(OrderItem(
            id=f"{order_id}-item-1",
            order_id=order_id,
            name="Test Product",
            image="/img/t.jpg",
            price=Decimal("200.00"),
            quantity=1,
        ))
        db.commit()

    return {"orderId": order_id, "reference": reference}


def _create_product_payload() -> dict:
    suffix = uuid4().hex[:8]
    return {
        "name": f"Admin Test Jacket {suffix}",
        "description": "A durable utility jacket built for integration tests.",
        "price": 145,
        "discount": 12,
        "images": [f"/products/test-{suffix}.jpg"],
        "categoryName": f"Tops {suffix}",
        "brandName": f"Spree Studio {suffix}",
        "collectionName": f"Launch Collection {suffix}",
        "stock": 18,
        "rating": 4.5,
        "reviewsCount": 8,
        "colors": ["Sand"],
        "sizes": ["M", "L"],
        "tags": ["featured"],
    }


def _seller_profile_payload(email: str, *, store_name: str = "Jamie Select") -> dict:
    return {
        "name": "Jamie Merchant",
        "email": email,
        "phone": "555-0100",
        "isSeller": True,
        "storeName": store_name,
        "sellerType": "wholesale",
        "storeDescription": "Curated essentials for every season.",
        "storeLocation": {
            "addressLine1": "123 Market Street",
            "city": "Accra",
            "state": "Greater Accra",
            "postalCode": "00233",
            "country": "Ghana",
        },
        "sellerContact": {
            "businessEmail": email,
            "businessPhone": "555-0199",
            "whatsapp": "555-0199",
            "registrationNumber": "SPREE-GH-123",
        },
        "sellerIdentity": {
            "governmentIdType": "ghana-card",
            "governmentIdNumber": "GHA-1234-5678",
            "storeTagline": "Modern essentials from Accra.",
        },
        "shippingAddress": {
            "fullName": "Jamie Merchant",
            "addressLine1": "123 Market Street",
            "addressLine2": "Suite 4",
            "city": "Accra",
            "state": "Greater Accra",
            "postalCode": "00233",
            "country": "Ghana",
        },
        "paymentInfo": {
            "method": "card",
            "cardholderName": "Jamie Merchant",
            "cardLast4": "4242",
            "expiryMonth": "04",
            "expiryYear": "2028",
            "billingPostalCode": "00233",
        },
    }


def test_healthcheck():
    with TestClient(app) as client:
        response = client.get("/healthz")

        assert response.status_code == 200
        assert response.json()["status"] == "ok"


def test_readiness_endpoint_checks_database():
    with TestClient(app) as client:
        response = client.get("/readyz")

        assert response.status_code == 200
        assert response.json() == {"status": "ready"}


def test_products_endpoint_returns_valid_catalog_shape():
    with TestClient(app) as client:
        response = client.get("/api/v1/products?sort=rating&limit=4")

        assert response.status_code == 200
        payload = response.json()
        assert "items" in payload
        assert "total" in payload
        assert "filters" in payload
        assert "priceRange" in payload["filters"]


def test_home_feed_supports_blank_catalog():
    with TestClient(app) as client:
        response = client.get("/api/v1/home")

        assert response.status_code == 200
        payload = response.json()
        assert "hero" in payload
        assert isinstance(payload["featuredProducts"], list)
        assert isinstance(payload["newArrivals"], list)
        assert isinstance(payload["categories"], list)


def test_login_endpoint_accepts_seeded_admin():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/login",
            headers=INTERNAL_HEADERS,
            json={
                "email": "admin@spree.local",
                "password": "ChangeMe123!",
            },
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload["email"] == "admin@spree.local"
        assert payload["role"] == "admin"


# ---------------------------------------------------------------------------
# A5/A7: DB-backed login rate limiting (enforced in the backend, so it can't
# be skipped by calling this endpoint directly instead of via the Next proxy)
# ---------------------------------------------------------------------------

def test_login_locks_out_after_five_failures_same_email():
    email = f"lockout-email-{uuid4().hex[:8]}@test.com"
    with TestClient(app) as client:
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Lockout Target", "email": email, "password": "RealPass123!"},
        )
        assert signup.status_code == 201

        for i in range(5):
            resp = client.post(
                "/api/v1/auth/login",
                headers={**INTERNAL_HEADERS, "X-Client-Ip": f"10.0.{i}.1"},
                json={"email": email, "password": "WrongPassword!"},
            )
            assert resp.status_code == 401, f"attempt {i} should be a plain auth failure"

        # 6th attempt (even from yet another IP, even with the correct password)
        # must be locked out by the per-email key.
        locked = client.post(
            "/api/v1/auth/login",
            headers={**INTERNAL_HEADERS, "X-Client-Ip": "10.0.99.1"},
            json={"email": email, "password": "RealPass123!"},
        )
        assert locked.status_code == 429
        assert locked.headers.get("retry-after")


def test_login_locks_out_after_five_failures_same_ip_different_emails():
    ip = f"10.1.{uuid4().hex[:2]}.1"
    with TestClient(app) as client:
        for i in range(5):
            resp = client.post(
                "/api/v1/auth/login",
                headers={**INTERNAL_HEADERS, "X-Client-Ip": ip},
                json={"email": f"spray-{i}-{uuid4().hex[:6]}@test.com", "password": "WrongPassword!"},
            )
            assert resp.status_code == 401

        locked = client.post(
            "/api/v1/auth/login",
            headers={**INTERNAL_HEADERS, "X-Client-Ip": ip},
            json={"email": f"spray-final-{uuid4().hex[:6]}@test.com", "password": "WrongPassword!"},
        )
        assert locked.status_code == 429


def test_login_direct_backend_call_is_still_rate_limited():
    """A5/A7 regression guard: even calling this endpoint directly (as if
    bypassing the Next proxy entirely, so no X-Client-Ip is set — only the
    backend's own edge-set X-Forwarded-For is available) must still hit the
    lockout — this is the exact gap the audit flagged (old limiter was
    Next-side, in-memory)."""
    email = f"direct-backend-{uuid4().hex[:8]}@test.com"
    attacker_ip = f"203.0.113.{uuid4().hex[:2]}"
    with TestClient(app) as client:
        for _ in range(5):
            resp = client.post(
                "/api/v1/auth/login",
                headers={**INTERNAL_HEADERS, "X-Forwarded-For": attacker_ip},
                json={"email": email, "password": "WrongPassword!"},
            )
            assert resp.status_code == 401

        locked = client.post(
            "/api/v1/auth/login",
            headers={**INTERNAL_HEADERS, "X-Forwarded-For": attacker_ip},
            json={"email": email, "password": "WrongPassword!"},
        )
        assert locked.status_code == 429


def test_login_success_clears_prior_failures():
    email = f"clears-lockout-{uuid4().hex[:8]}@test.com"
    ip = f"10.2.{uuid4().hex[:2]}.1"
    with TestClient(app) as client:
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Clears Lockout", "email": email, "password": "RealPass123!"},
        )
        assert signup.status_code == 201

        for _ in range(3):
            resp = client.post(
                "/api/v1/auth/login",
                headers={**INTERNAL_HEADERS, "X-Client-Ip": ip},
                json={"email": email, "password": "WrongPassword!"},
            )
            assert resp.status_code == 401

        ok = client.post(
            "/api/v1/auth/login",
            headers={**INTERNAL_HEADERS, "X-Client-Ip": ip},
            json={"email": email, "password": "RealPass123!"},
        )
        assert ok.status_code == 200

        # Prior failures were cleared by the successful login, so 3 more
        # failures shouldn't reach the 5-attempt lockout yet.
        for _ in range(3):
            resp = client.post(
                "/api/v1/auth/login",
                headers={**INTERNAL_HEADERS, "X-Client-Ip": ip},
                json={"email": email, "password": "WrongPassword!"},
            )
            assert resp.status_code == 401


# ---------------------------------------------------------------------------
# A6: password reset flow
# ---------------------------------------------------------------------------

def _extract_reset_token(monkeypatch) -> list[str]:
    """Capture the token minted by request_password_reset without needing a
    real Resend account — patches notify_safe to record the cta_url it was
    given and pulls the token back out of it."""
    from app.services import auth as auth_svc

    captured: list[str] = []
    original = auth_svc.notify_safe

    def _fake_notify_safe(db, **kwargs):
        cta_url = kwargs.get("cta_url") or ""
        if "token=" in cta_url:
            captured.append(cta_url.split("token=")[1])

    monkeypatch.setattr(auth_svc, "notify_safe", _fake_notify_safe)
    return captured


def test_password_reset_happy_path(monkeypatch):
    captured = _extract_reset_token(monkeypatch)
    with TestClient(app) as client:
        email = f"reset-happy-{uuid4().hex[:8]}@test.com"
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Reset Happy", "email": email, "password": "OldPass123!"},
        )
        assert signup.status_code == 201

        req = client.post(
            "/api/v1/auth/password-reset/request",
            headers=INTERNAL_HEADERS,
            json={"email": email},
        )
        assert req.status_code == 200
        assert captured, "expected request_password_reset to email a reset link"
        token = captured[0]

        confirm = client.post(
            "/api/v1/auth/password-reset/confirm",
            headers=INTERNAL_HEADERS,
            json={"token": token, "password": "NewPass456!"},
        )
        assert confirm.status_code == 200

        # Old password no longer works; new password does.
        old_login = client.post(
            "/api/v1/auth/login",
            headers={**INTERNAL_HEADERS, "X-Client-Ip": "10.5.0.1"},
            json={"email": email, "password": "OldPass123!"},
        )
        assert old_login.status_code == 401

        new_login = client.post(
            "/api/v1/auth/login",
            headers={**INTERNAL_HEADERS, "X-Client-Ip": "10.5.0.1"},
            json={"email": email, "password": "NewPass456!"},
        )
        assert new_login.status_code == 200


def test_password_reset_token_is_single_use():
    with TestClient(app) as client:
        email = f"reset-reuse-{uuid4().hex[:8]}@test.com"
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Reset Reuse", "email": email, "password": "OldPass123!"},
        )
        assert signup.status_code == 201

        from app.db.session import SessionLocal
        from app.db.models import VerificationToken
        from datetime import datetime, timedelta, timezone
        from uuid import uuid4 as _uuid4

        token = _uuid4().hex
        with SessionLocal() as db:
            db.add(VerificationToken(
                id=_uuid4().hex,
                email=email,
                token=token,
                purpose="password_reset",
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            ))
            db.commit()

        first = client.post(
            "/api/v1/auth/password-reset/confirm",
            headers=INTERNAL_HEADERS,
            json={"token": token, "password": "NewPass456!"},
        )
        assert first.status_code == 200

        second = client.post(
            "/api/v1/auth/password-reset/confirm",
            headers=INTERNAL_HEADERS,
            json={"token": token, "password": "AnotherPass789!"},
        )
        assert second.status_code == 400


def test_password_reset_expired_token_rejected():
    with TestClient(app) as client:
        email = f"reset-expired-{uuid4().hex[:8]}@test.com"
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Reset Expired", "email": email, "password": "OldPass123!"},
        )
        assert signup.status_code == 201

        from app.db.session import SessionLocal
        from app.db.models import VerificationToken
        from datetime import datetime, timedelta, timezone
        from uuid import uuid4 as _uuid4

        token = _uuid4().hex
        with SessionLocal() as db:
            db.add(VerificationToken(
                id=_uuid4().hex,
                email=email,
                token=token,
                purpose="password_reset",
                expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),
            ))
            db.commit()

        resp = client.post(
            "/api/v1/auth/password-reset/confirm",
            headers=INTERNAL_HEADERS,
            json={"token": token, "password": "NewPass456!"},
        )
        assert resp.status_code == 400


def test_password_reset_request_does_not_leak_account_existence():
    with TestClient(app) as client:
        known = client.post(
            "/api/v1/auth/password-reset/request",
            headers=INTERNAL_HEADERS,
            json={"email": "admin@spree.local"},
        )
        unknown = client.post(
            "/api/v1/auth/password-reset/request",
            headers=INTERNAL_HEADERS,
            json={"email": f"no-such-user-{uuid4().hex[:8]}@test.com"},
        )
        assert known.status_code == unknown.status_code == 200
        assert known.json() == unknown.json()


def test_password_reset_does_not_consume_email_verification_token():
    """A6: purpose scoping — a password-reset token must not verify email,
    and vice versa (they share a table, distinguished by `purpose`)."""
    with TestClient(app) as client:
        email = f"reset-scope-{uuid4().hex[:8]}@test.com"
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Reset Scope", "email": email, "password": "OldPass123!"},
        )
        assert signup.status_code == 201

        from app.db.session import SessionLocal
        from app.db.models import VerificationToken
        from datetime import datetime, timedelta, timezone
        from uuid import uuid4 as _uuid4

        token = _uuid4().hex
        with SessionLocal() as db:
            db.add(VerificationToken(
                id=_uuid4().hex,
                email=email,
                token=token,
                purpose="password_reset",
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            ))
            db.commit()

        resp = client.post(
            "/api/v1/auth/verify-email",
            headers=INTERNAL_HEADERS,
            json={"token": token},
        )
        assert resp.status_code == 400


def test_signup_endpoint_creates_customer_account():
    with TestClient(app) as client:
        email = f"taylor-{uuid4().hex[:8]}@example.com"
        response = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={
                "name": "Taylor Shopper",
                "email": email,
                "password": "Storefront123!",
            },
        )

        assert response.status_code == 201
        payload = response.json()
        assert payload["email"] == email
        assert payload["role"] == "customer"


# ---------------------------------------------------------------------------
# 2026-07-10 email flow assessment — signup verification email pipeline
# ---------------------------------------------------------------------------

def test_send_verification_then_verify_email_flips_flag():
    """The EXISTING pipeline (create_verification_token + verify-email) works
    end to end: a fresh signup is email_verified=False; requesting a token via
    /auth/send-verification and redeeming it via /auth/verify-email flips it
    to True, reflected on the next login."""
    with TestClient(app) as client:
        email = f"verify-flow-{uuid4().hex[:8]}@example.com"
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Verify Flow", "email": email, "password": "VerifyFlow123!"},
        )
        assert signup.status_code == 201
        assert signup.json()["email_verified"] is False

        token_resp = client.post(
            "/api/v1/auth/send-verification",
            headers=INTERNAL_HEADERS,
            json={"email": email},
        )
        assert token_resp.status_code == 200
        token = token_resp.json()["token"]

        verify_resp = client.post(
            "/api/v1/auth/verify-email",
            headers=INTERNAL_HEADERS,
            json={"token": token},
        )
        assert verify_resp.status_code == 200
        assert verify_resp.json()["email_verified"] is True

        login_resp = client.post(
            "/api/v1/auth/login",
            headers={**INTERNAL_HEADERS, "X-Client-Ip": f"10.9.{uuid4().hex[:2]}.1"},
            json={"email": email, "password": "VerifyFlow123!"},
        )
        assert login_resp.status_code == 200
        assert login_resp.json()["email_verified"] is True


# ---------------------------------------------------------------------------
# A11: NIST-style password policy
# ---------------------------------------------------------------------------

def test_signup_rejects_common_password():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={
                "name": "Common Password User",
                "email": f"common-pw-{uuid4().hex[:8]}@example.com",
                "password": "password123",
            },
        )
        assert response.status_code == 422
        assert "too common" in response.json()["detail"].lower()


def test_signup_rejects_common_password_case_insensitive():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={
                "name": "Common Password User",
                "email": f"common-pw-case-{uuid4().hex[:8]}@example.com",
                "password": "QWERTY123",
            },
        )
        assert response.status_code == 422
        assert "too common" in response.json()["detail"].lower()


def test_signup_accepts_long_passphrase_without_composition_rules():
    """A11: the mandatory upper/lower/digit/symbol composition rule was
    dropped in favor of a length-first NIST-style policy — a long,
    all-lowercase passphrase with no digits or symbols must now succeed."""
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={
                "name": "Passphrase User",
                "email": f"passphrase-{uuid4().hex[:8]}@example.com",
                "password": "correcthorsebatterystaple",
            },
        )
        assert response.status_code == 201


def test_signup_rejects_password_over_max_length():
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={
                "name": "Huge Password User",
                "email": f"huge-pw-{uuid4().hex[:8]}@example.com",
                "password": "a1" * 100,  # 200 chars, well over the 128 cap
            },
        )
        assert response.status_code == 422


def test_password_reset_confirm_rejects_common_password():
    with TestClient(app) as client:
        email = f"reset-common-pw-{uuid4().hex[:8]}@test.com"
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Reset Common", "email": email, "password": "OriginalPass123!"},
        )
        assert signup.status_code == 201

        from app.db.session import SessionLocal
        from app.db.models import VerificationToken
        from datetime import datetime, timedelta, timezone
        from uuid import uuid4 as _uuid4

        token = _uuid4().hex
        with SessionLocal() as db:
            db.add(VerificationToken(
                id=_uuid4().hex,
                email=email,
                token=token,
                purpose="password_reset",
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            ))
            db.commit()

        resp = client.post(
            "/api/v1/auth/password-reset/confirm",
            headers=INTERNAL_HEADERS,
            json={"token": token, "password": "letmein123"},
        )
        assert resp.status_code == 422
        assert "too common" in resp.json()["detail"].lower()


def test_profile_endpoint_updates_customer_to_seller():
    with TestClient(app) as client:
        email = f"vendor-{uuid4().hex[:8]}@example.com"
        signup_response = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={
                "name": "Jamie Merchant",
                "email": email,
                "password": "Storefront123!",
            },
        )

        assert signup_response.status_code == 201
        created_user = signup_response.json()
        store_name = f"Jamie Select {uuid4().hex[:6]}"

        profile_response = client.put(
            f"/api/v1/auth/profile/{created_user['id']}",
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token(created_user["id"])},
            json=_seller_profile_payload(email, store_name=store_name),
        )

        assert profile_response.status_code == 200
        payload = profile_response.json()
        assert payload["role"] == "vendor"
        assert payload["sellerStatus"] == "pending"
        assert payload["storeName"] == store_name
        assert payload["sellerType"] == "wholesale"
        assert payload["storeLocation"]["city"] == "Accra"
        assert payload["sellerContact"]["businessPhone"] == "555-0199"
        assert payload["sellerIdentity"]["governmentIdNumber"] == "GHA-1234-5678"
        assert payload["shippingAddress"]["city"] == "Accra"
        assert payload["paymentInfo"]["cardLast4"] == "4242"


def test_suspended_seller_cannot_reactivate_through_profile_update():
    with TestClient(app) as client:
        email = f"paused-vendor-{uuid4().hex[:8]}@example.com"
        signup_response = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={
                "name": "Jamie Merchant",
                "email": email,
                "password": "Storefront123!",
            },
        )
        assert signup_response.status_code == 201
        created_user = signup_response.json()

        profile_response = client.put(
            f"/api/v1/auth/profile/{created_user['id']}",
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token(created_user["id"])},
            json=_seller_profile_payload(email, store_name=f"Paused Select {uuid4().hex[:6]}"),
        )
        assert profile_response.status_code == 200
        assert profile_response.json()["sellerStatus"] == "pending"

        accept_response = client.put(
            f"/api/v1/admin/sellers/{created_user['id']}/status",
            headers=ADMIN_HEADERS,
            json={
                "status": "active",
                "sellerNotice": "",
                "adminNote": "Accepted for selling",
                "sellerBadge": "Verified vendor",
                "completedDeliveries": 12,
                "averageDeliveryDays": 1.8,
                "governmentIdVerified": True,
            },
        )
        assert accept_response.status_code == 200
        assert accept_response.json()["sellerStatus"] == "active"
        assert accept_response.json()["sellerBadge"] == "Verified vendor"
        assert accept_response.json()["completedDeliveries"] == 12

        suspend_response = client.put(
            f"/api/v1/admin/sellers/{created_user['id']}/status",
            headers=ADMIN_HEADERS,
            json={
                "status": "suspended",
                "sellerNotice": "Identity review needed",
                "adminNote": "Regression guard",
                "sellerBadge": "Verified vendor",
                "completedDeliveries": 12,
                "averageDeliveryDays": 1.8,
                "governmentIdVerified": True,
            },
        )
        assert suspend_response.status_code == 200
        assert suspend_response.json()["sellerStatus"] == "suspended"

        updated_profile_response = client.put(
            f"/api/v1/auth/profile/{created_user['id']}",
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token(created_user["id"])},
            json=_seller_profile_payload(email, store_name=suspend_response.json()["storeName"]),
        )

        assert updated_profile_response.status_code == 200
        updated_profile = updated_profile_response.json()
        assert updated_profile["role"] == "vendor"
        assert updated_profile["sellerStatus"] == "suspended"
        assert updated_profile["sellerNotice"] == "Identity review needed"


def test_product_details_endpoint_returns_created_product():
    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/products",
            json=_create_product_payload(),
            headers={
                "X-Internal-Api-Key": INTERNAL_KEY,
                "X-Actor-Token": actor_token("user-admin", "admin"),
            },
        )
        assert create_response.status_code == 201
        created = create_response.json()

        response = client.get(f"/api/v1/products/{created['id']}")

        assert response.status_code == 200
        payload = response.json()
        assert payload["id"] == created["id"]
        assert payload["category"] == created["category"]
        assert "variants" in payload


def test_admin_product_creation_requires_internal_api_key():
    with TestClient(app) as client:
        payload = _create_product_payload()

        unauthorized = client.post("/api/v1/products", json=payload)
        assert unauthorized.status_code == 401

        response = client.post(
            "/api/v1/products",
            json=payload,
            headers={
                "X-Internal-Api-Key": INTERNAL_KEY,
                "X-Actor-Token": actor_token("user-admin", "admin"),
            },
        )

        assert response.status_code == 201
        created = response.json()
        assert created["name"] == payload["name"]
        assert created["stock"] == 18
        assert created["discount"] == 12


# ---------------------------------------------------------------------------
# Chat endpoint tests
# ---------------------------------------------------------------------------

def test_chat_token_requires_internal_api_key():
    """GET /chat/token must reject requests without the internal API key."""
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/chat/token",
            headers={"X-Actor-User-Id": "user-123"},
        )
        assert response.status_code == 401


def test_chat_token_requires_actor_user_id():
    """GET /chat/token must return 401 when no actor user id is provided."""
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/chat/token",
            headers=INTERNAL_HEADERS,
        )
        # 401 because actor_id is None
        assert response.status_code == 401


def test_chat_token_returns_503_when_stream_not_configured():
    """GET /chat/token returns 503 gracefully when Stream env vars are not set."""
    with TestClient(app) as client:
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Chat Tester", "email": f"chat-test-{uuid4().hex[:8]}@test.com", "password": "ChatPass123!"},
        )
        assert signup.status_code == 201
        uid = signup.json()["id"]

        response = client.get(
            "/api/v1/chat/token",
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token(uid)},
        )
        # Either 503 (Stream not configured) or 200 (if STREAM_API_KEY is set in test env)
        assert response.status_code in (200, 503)
        if response.status_code == 200:
            data = response.json()
            assert "token" in data
            assert "userId" in data
            assert "channelId" in data
            assert data["channelId"] == f"support-{uid}"
        else:
            assert "Stream Chat" in response.json().get("detail", "")


def test_chat_admin_token_requires_admin_role():
    """POST /chat/admin-token must reject non-admin users."""
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/chat/admin-token",
            headers={**INTERNAL_HEADERS, "X-Actor-Role": "customer"},
        )
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# A2: actor token verification tests
# ---------------------------------------------------------------------------

def test_forged_actor_token_wrong_secret_is_rejected():
    """A token signed with a different secret than ACTOR_TOKEN_SECRET must be
    rejected (401), not silently trusted — this is exactly the forgery A2
    closes off (previously a raw X-Actor-Role: admin header was enough)."""
    import jwt as _jwt
    from datetime import datetime, timezone, timedelta as _timedelta

    now = datetime.now(timezone.utc)
    forged = _jwt.encode(
        {
            "sub": "user-admin",
            "role": "admin",
            "iss": "spree-next-proxy",
            "aud": "spree-backend",
            "iat": now,
            "exp": now + _timedelta(seconds=60),
        },
        "attacker-controlled-secret-not-the-real-one",
        algorithm="HS256",
    )
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/orders/order-does-not-matter/refund",
            headers={**INTERNAL_HEADERS, "X-Actor-Token": forged},
        )
        assert response.status_code == 401


def test_forged_actor_token_expired_is_rejected():
    """An expired actor token must be rejected, not treated as anonymous."""
    import jwt as _jwt
    from datetime import datetime, timezone, timedelta as _timedelta
    from app.core.config import settings as svc_settings

    now = datetime.now(timezone.utc)
    expired = _jwt.encode(
        {
            "sub": "user-admin",
            "role": "admin",
            "iss": "spree-next-proxy",
            "aud": "spree-backend",
            "iat": now - _timedelta(seconds=120),
            "exp": now - _timedelta(seconds=60),
        },
        svc_settings.actor_token_secret,
        algorithm="HS256",
    )
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/orders/order-does-not-matter/refund",
            headers={**INTERNAL_HEADERS, "X-Actor-Token": expired},
        )
        assert response.status_code == 401


def test_plain_actor_role_header_no_longer_grants_admin():
    """A2 regression guard: a raw X-Actor-Role: admin header with no signed
    token must NOT be trusted — this is the exact vulnerability the audit
    flagged (spoofable headers gated only by the shared internal key)."""
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/orders/order-does-not-matter/refund",
            headers={**INTERNAL_HEADERS, "X-Actor-Role": "admin", "X-Actor-User-Id": "user-admin"},
        )
        # Falls back to the "customer" default (no valid X-Actor-Token) → 403,
        # not treated as admin.
        assert response.status_code == 403


# ---------------------------------------------------------------------------
# A10: role/status revalidated from the DB, not trusted from the token claim
# ---------------------------------------------------------------------------

def test_blacklisted_admin_loses_access_despite_valid_admin_token():
    """A blacklisted admin's actor token still claims role=admin (it was
    minted from their now-stale Next-side session), but the backend must
    re-check the DB and refuse — this is the exact scenario the audit
    flagged: a blacklisted/soft-deleted user keeping access until their JWT
    naturally expires."""
    from app.db.session import SessionLocal
    from app.db.models import User

    with TestClient(app) as client:
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Rogue Admin", "email": f"rogue-admin-{uuid4().hex[:8]}@test.com", "password": "RoguePass123!"},
        )
        assert signup.status_code == 201
        uid = signup.json()["id"]

        with SessionLocal() as db:
            user = db.get(User, uid)
            user.role = "admin"
            db.commit()

        # Token still claims "admin" — as if minted before the blacklist below.
        admin_hdrs = {**INTERNAL_HEADERS, "X-Actor-Token": actor_token(uid, "admin")}
        ok = client.get("/api/v1/admin/verification", headers=admin_hdrs)
        assert ok.status_code == 200

        with SessionLocal() as db:
            user = db.get(User, uid)
            user.is_blacklisted = True
            db.commit()

        blocked = client.get("/api/v1/admin/verification", headers=admin_hdrs)
        assert blocked.status_code == 403


def test_soft_deleted_user_treated_as_anonymous():
    from app.db.session import SessionLocal
    from app.db.models import User
    from datetime import datetime, timezone

    with TestClient(app) as client:
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Deleted User", "email": f"deleted-user-{uuid4().hex[:8]}@test.com", "password": "DeletedPass123!"},
        )
        assert signup.status_code == 201
        uid = signup.json()["id"]

        with SessionLocal() as db:
            user = db.get(User, uid)
            user.role = "admin"
            user.deleted_at = datetime.now(timezone.utc)
            db.commit()

        blocked = client.get(
            "/api/v1/admin/verification",
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token(uid, "admin")},
        )
        assert blocked.status_code == 403


def test_demoted_vendor_role_downgrade_takes_effect_immediately():
    """A vendor demoted back to customer by an admin must lose vendor-level
    access on the very next request, even with an actor token still
    claiming role=vendor from before the demotion."""
    with TestClient(app) as client:
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Demoted Vendor", "email": f"demoted-{uuid4().hex[:8]}@test.com", "password": "VendorPass123!"},
        )
        assert signup.status_code == 201
        uid = signup.json()["id"]

        from app.db.session import SessionLocal
        from app.db.models import User

        with SessionLocal() as db:
            user = db.get(User, uid)
            user.role = "customer"
            db.commit()

        # Actor token claims "vendor" (stale), but /admin/verification requires
        # the DB-derived role to be "admin" — demonstrates the claim alone
        # carries no weight; it's the re-fetched User.role that's checked.
        stale_vendor_token = {**INTERNAL_HEADERS, "X-Actor-Token": actor_token(uid, "vendor")}
        resp = client.get("/api/v1/admin/verification", headers=stale_vendor_token)
        assert resp.status_code == 403


def test_actor_token_rejected_when_session_predates_password_reset():
    """A10 follow-up: an actor token minted from a session established
    BEFORE the user's password was reset must be treated as anonymous, not
    trusted until the session's own maxAge naturally expires."""
    from datetime import datetime, timedelta, timezone
    from app.db.session import SessionLocal
    from app.db.models import User

    with TestClient(app) as client:
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Reset Session Admin", "email": f"reset-session-{uuid4().hex[:8]}@test.com", "password": "AdminPass123!"},
        )
        assert signup.status_code == 201
        uid = signup.json()["id"]

        password_changed_at = datetime.now(timezone.utc)
        with SessionLocal() as db:
            user = db.get(User, uid)
            user.role = "admin"
            user.password_changed_at = password_changed_at
            db.commit()

        # Session established 5 minutes BEFORE the password reset above.
        stale_session_iat = int((password_changed_at - timedelta(minutes=5)).timestamp())
        stale_headers = {
            **INTERNAL_HEADERS,
            "X-Actor-Token": actor_token(uid, "admin", session_issued_at=stale_session_iat),
        }
        resp = client.get("/api/v1/admin/verification", headers=stale_headers)
        assert resp.status_code == 403


def test_actor_token_accepted_when_session_postdates_password_reset():
    """A session established AFTER the password reset (e.g. the user logged
    back in after resetting) must keep working normally."""
    from datetime import datetime, timedelta, timezone
    from app.db.session import SessionLocal
    from app.db.models import User

    with TestClient(app) as client:
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Fresh Session Admin", "email": f"fresh-session-{uuid4().hex[:8]}@test.com", "password": "AdminPass123!"},
        )
        assert signup.status_code == 201
        uid = signup.json()["id"]

        password_changed_at = datetime.now(timezone.utc)
        with SessionLocal() as db:
            user = db.get(User, uid)
            user.role = "admin"
            user.password_changed_at = password_changed_at
            db.commit()

        # Session established 5 minutes AFTER the password reset above.
        fresh_session_iat = int((password_changed_at + timedelta(minutes=5)).timestamp())
        fresh_headers = {
            **INTERNAL_HEADERS,
            "X-Actor-Token": actor_token(uid, "admin", session_issued_at=fresh_session_iat),
        }
        resp = client.get("/api/v1/admin/verification", headers=fresh_headers)
        assert resp.status_code == 200


def test_actor_token_without_siat_claim_is_not_rejected():
    """Backward compat: a token minted without the `siat` claim (e.g. during
    a mixed frontend/backend deploy window) must not be treated as expired —
    the session-age check is skipped, not fail-closed, for this population."""
    from datetime import datetime, timezone
    from app.db.session import SessionLocal
    from app.db.models import User

    with TestClient(app) as client:
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "No Siat Admin", "email": f"no-siat-{uuid4().hex[:8]}@test.com", "password": "AdminPass123!"},
        )
        assert signup.status_code == 201
        uid = signup.json()["id"]

        with SessionLocal() as db:
            user = db.get(User, uid)
            user.role = "admin"
            user.password_changed_at = datetime.now(timezone.utc)
            db.commit()

        # No session_issued_at passed at all — same as actor_token()'s default.
        no_siat_headers = {**INTERNAL_HEADERS, "X-Actor-Token": actor_token(uid, "admin")}
        resp = client.get("/api/v1/admin/verification", headers=no_siat_headers)
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# A3: OAuth auto-link account-takeover tests
# ---------------------------------------------------------------------------

def test_oauth_upsert_denies_link_when_provider_email_unverified():
    """An attacker who signs in via OAuth with an unverified claim to a
    victim's existing email must NOT be linked into the victim's account."""
    with TestClient(app) as client:
        email = f"oauth-takeover-{uuid4().hex[:8]}@example.com"
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Victim", "email": email, "password": "VictimPass123!"},
        )
        assert signup.status_code == 201

        resp = client.post(
            "/api/v1/auth/oauth-upsert",
            headers=INTERNAL_HEADERS,
            json={
                "email": email,
                "name": "Attacker",
                "provider": "google",
                "provider_account_id": "attacker-google-id",
                "email_verified": False,
            },
        )
        assert resp.status_code == 403

        # The victim's account must still be password-only — not linked.
        with TestClient(app) as client2:
            login = client2.post(
                "/api/v1/auth/login",
                headers=INTERNAL_HEADERS,
                json={"email": email, "password": "VictimPass123!"},
            )
            assert login.status_code == 200


def test_oauth_upsert_denies_link_to_existing_password_account_even_when_verified():
    """Even with a provider-verified email, auto-linking into an existing
    password account is denied — the attacker must not gain access just
    because they happen to control a verified OAuth identity for that
    address (email verification alone doesn't prove they set the password)."""
    with TestClient(app) as client:
        email = f"oauth-takeover-verified-{uuid4().hex[:8]}@example.com"
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Victim", "email": email, "password": "VictimPass123!"},
        )
        assert signup.status_code == 201

        resp = client.post(
            "/api/v1/auth/oauth-upsert",
            headers=INTERNAL_HEADERS,
            json={
                "email": email,
                "name": "Attacker",
                "provider": "google",
                "provider_account_id": "attacker-google-id-2",
                "email_verified": True,
            },
        )
        assert resp.status_code == 409


def test_oauth_upsert_creates_new_user_when_no_existing_account():
    """A brand-new email with a verified OAuth claim creates a fresh account
    (not blocked — nothing to take over)."""
    with TestClient(app) as client:
        email = f"oauth-newuser-{uuid4().hex[:8]}@example.com"
        resp = client.post(
            "/api/v1/auth/oauth-upsert",
            headers=INTERNAL_HEADERS,
            json={
                "email": email,
                "name": "Fresh User",
                "provider": "google",
                "provider_account_id": "fresh-google-id",
                "email_verified": True,
            },
        )
        assert resp.status_code == 200
        assert resp.json()["email_verified"] is True


# ---------------------------------------------------------------------------
# A4: email verification gates sensitive actions
# ---------------------------------------------------------------------------

def test_checkout_rejects_unverified_signed_in_buyer():
    """A signed-in buyer with an unverified email cannot check out."""
    with TestClient(app) as client:
        email = f"unverified-buyer-{uuid4().hex[:8]}@test.com"
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Unverified Buyer", "email": email, "password": "BuyerPass123!"},
        )
        assert signup.status_code == 201
        uid = signup.json()["id"]

        prod_resp = client.post(
            "/api/v1/products",
            json=_create_product_payload(),
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token("user-admin", "admin")},
        )
        assert prod_resp.status_code == 201
        product = prod_resp.json()

        resp = client.post(
            "/api/v1/orders/initialize-payment",
            headers=INTERNAL_HEADERS,
            json={
                "userId": uid,
                "fullName": "Unverified Buyer",
                "email": email,
                "phone": "0240000000",
                "addressLine1": "1 Test St",
                "city": "Accra",
                "state": "Greater Accra",
                "postalCode": "00233",
                "country": "Ghana",
                "shippingMethod": "standard",
                "paymentMethod": "card",
                "subtotal": float(product["price"]),
                "shippingCost": 0.0,
                "tax": 0.0,
                "total": float(product["price"]),
                "currency": "GHS",
                "items": [{
                    "productId": product["id"],
                    "name": product["name"],
                    "image": "/img/test.jpg",
                    "price": float(product["price"]),
                    "quantity": 1,
                }],
            },
        )
        assert resp.status_code == 403
        assert "verify your email" in resp.json()["detail"].lower()


def test_checkout_allows_guest_regardless_of_verification():
    """Guest checkout (no userId) is not gated on email verification."""
    with TestClient(app) as client:
        prod_resp = client.post(
            "/api/v1/products",
            json=_create_product_payload(),
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token("user-admin", "admin")},
        )
        assert prod_resp.status_code == 201
        product = prod_resp.json()

        resp = client.post(
            "/api/v1/orders/initialize-payment",
            headers=INTERNAL_HEADERS,
            json={
                "userId": None,
                "fullName": "Guest Buyer",
                "email": "guest@test.com",
                "phone": "0240000000",
                "addressLine1": "1 Test St",
                "city": "Accra",
                "state": "Greater Accra",
                "postalCode": "00233",
                "country": "Ghana",
                "shippingMethod": "standard",
                "paymentMethod": "card",
                "subtotal": float(product["price"]),
                "shippingCost": 0.0,
                "tax": 0.0,
                "total": float(product["price"]),
                "currency": "GHS",
                "items": [{
                    "productId": product["id"],
                    "name": product["name"],
                    "image": "/img/test.jpg",
                    "price": float(product["price"]),
                    "quantity": 1,
                }],
            },
        )
        assert resp.status_code != 403


def test_submit_onboarding_rejects_unverified_email():
    """Seller onboarding cannot be submitted until the seller's email is verified."""
    with TestClient(app) as client:
        email = f"unverified-seller-{uuid4().hex[:8]}@test.com"
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Unverified Seller", "email": email, "password": "SellerPass123!"},
        )
        assert signup.status_code == 201
        uid = signup.json()["id"]
        hdrs = {**INTERNAL_HEADERS, "X-Actor-Token": actor_token(uid)}

        client.patch("/api/v1/auth/onboarding/step/1", headers=hdrs,
                     json={"name": "Unverified Seller", "phone": "0241234567", "termsAccepted": True})
        client.patch("/api/v1/auth/onboarding/step/2", headers=hdrs,
                     json={"country": "Ghana", "state": "Greater Accra",
                           "city": "Accra", "addressLine1": "1 Seller Lane"})
        client.patch("/api/v1/auth/onboarding/step/3", headers=hdrs,
                     json={"storeName": f"Unverified Store {uuid4().hex[:6]}",
                           "storeDescription": "Quality goods from Accra since 2020.",
                           "sellerType": "retail"})
        client.patch("/api/v1/auth/onboarding/step/4", headers=hdrs,
                     json={"governmentIdType": "ghana-card", "governmentIdNumber": "GHA-987654321-0"})

        resp = client.post("/api/v1/auth/onboarding/submit", headers=hdrs)
        assert resp.status_code == 403
        assert "verify your email" in resp.json()["detail"].lower()


def test_comment_rejects_unverified_email():
    """Posting a product comment/review requires a verified email."""
    with TestClient(app) as client:
        email = f"unverified-commenter-{uuid4().hex[:8]}@test.com"
        signup = client.post(
            "/api/v1/auth/signup",
            headers=INTERNAL_HEADERS,
            json={"name": "Unverified Commenter", "email": email, "password": "CommentPass123!"},
        )
        assert signup.status_code == 201
        uid = signup.json()["id"]

        prod_resp = client.post(
            "/api/v1/products",
            json=_create_product_payload(),
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token("user-admin", "admin")},
        )
        assert prod_resp.status_code == 201
        product_id = prod_resp.json()["id"]

        resp = client.post(
            f"/api/v1/products/{product_id}/comments",
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token(uid)},
            json={"body": "Great product!", "rating": 5},
        )
        assert resp.status_code == 403
        assert "verify your email" in resp.json()["detail"].lower()


def test_stream_webhook_accepts_non_message_events():
    """POST /webhooks/stream should return 200 for non-message events."""
    with TestClient(app) as client:
        response = client.post(
            "/webhooks/stream",
            json={"type": "channel.created"},
        )
        assert response.status_code == 200
        assert response.json() == {"ok": True}


def test_stream_webhook_skips_admin_messages():
    """POST /webhooks/stream should no-op when the sender is the admin user."""
    with TestClient(app) as client:
        response = client.post(
            "/webhooks/stream",
            json={
                "type": "message.new",
                "channel_id": "support-user-abc",
                "channel_type": "support",
                "message": {
                    "text": "Hello from admin",
                    "user": {"id": "spree-admin"},
                },
            },
        )
        assert response.status_code == 200
        assert response.json() == {"ok": True}


# ---------------------------------------------------------------------------
# Payment regression tests
# ---------------------------------------------------------------------------

def test_refund_idempotency_second_call_returns_409():
    """Bug #1 regression: refunding an already-refunded order must return 409,
    not call Paystack again (which would double-refund the buyer)."""
    import unittest.mock as mock
    from app.services import paystack as paystack_svc

    order = _create_paid_order_in_db()
    order_id = order["orderId"]

    # Mock Paystack so the test doesn't hit the real API (test key returns 403).
    with mock.patch.object(paystack_svc, "refund_transaction", return_value={}):
        with TestClient(app) as client:
            # First refund: Paystack mock succeeds → status = "refunded"
            r1 = client.post(f"/api/v1/orders/{order_id}/refund", headers=ADMIN_HEADERS)
            assert r1.status_code == 200, r1.text
            assert r1.json()["status"] == "refunded"

            # Second refund: order is already "refunded" — must be rejected with 409
            # (not 200, which would mean Paystack was called a second time)
            r2 = client.post(f"/api/v1/orders/{order_id}/refund", headers=ADMIN_HEADERS)
            assert r2.status_code == 409, (
                "Second refund call must return 409, not 200 — "
                "a 200 here would mean a double-refund could be issued"
            )


def test_auto_release_does_not_double_process_delivered_orders():
    """Bug #2 regression: calling auto_release twice on the same delivered order
    must release it exactly once (second call sees non-delivered status and skips)."""
    from app.db.session import SessionLocal
    from app.db.models import Order

    order = _create_paid_order_in_db()
    order_id = order["orderId"]

    # Force the order into 'delivered' with an old timestamp so it qualifies.
    with SessionLocal() as db:
        db_order = db.get(Order, order_id)
        db_order.status = "delivered"
        db_order.delivered_at = datetime.now(timezone.utc) - timedelta(days=10)
        db.commit()

    with TestClient(app) as client:
        # First call: should find and release the order
        r1 = client.post("/api/v1/cron/auto-release", headers=ADMIN_HEADERS)
        assert r1.status_code == 200, r1.text
        assert r1.json()["released"] >= 1

        # Second call: order is now "confirmed" or "paid_out", not "delivered" — skip
        r2 = client.post("/api/v1/cron/auto-release", headers=ADMIN_HEADERS)
        assert r2.status_code == 200
        # released count must not include our order again
        assert r2.json().get("released", 0) == 0


def test_webhook_retry_does_not_double_notify_order_placed():
    """2026-07-10 email flow assessment, STEP 3 finding: a sequential webhook
    retry of the same charge.success event does NOT double-fire order_placed
    — the existing `order.status == "pending"` guard in
    handle_paystack_webhook already makes _mark_order_paid's notifications
    idempotent for this (the realistic) retry pattern, contrary to the
    "no guard" premise in the original task prompt. No new idempotency-stamp
    columns were added as a result — see FIXLOG.md. Kept as a permanent
    regression test guarding this invariant."""
    import unittest.mock as mock
    from decimal import Decimal
    from app.db.session import SessionLocal
    from app.db.models import Order, OrderItem
    from app.services import orders as orders_svc

    order_id = f"order-webhook-retry-{uuid4().hex[:8]}"
    reference = f"ref-webhook-retry-{uuid4().hex[:8]}"
    notify_calls: list[str] = []

    def _fake_notify_safe(db, **kwargs):
        notify_calls.append(kwargs.get("event_type"))

    with TestClient(app):
        with SessionLocal() as db:
            db.add(Order(
                id=order_id, user_id="user-admin", status="pending", full_name="Retry Buyer",
                email=f"retry-{uuid4().hex[:6]}@test.com",
                address_line1="1 Test St", city="Accra", state="Greater Accra",
                postal_code="00233", country="Ghana", shipping_method="standard",
                payment_method="card", subtotal=Decimal("100.00"), shipping_cost=Decimal("10.00"),
                tax=Decimal("1.50"), total=Decimal("111.50"), currency="GHS",
                paystack_reference=reference,
            ))
            db.add(OrderItem(
                id=f"{order_id}-item1", order_id=order_id, name="Test Item",
                image="/img/t.jpg", price=Decimal("100.00"), quantity=1,
            ))
            db.commit()

        with mock.patch.object(orders_svc, "notify_safe", side_effect=_fake_notify_safe):
            orders_svc.handle_paystack_webhook(
                SessionLocal(), "charge.success", {"reference": reference, "id": "tx-1"}
            )
            # Sequential retry of the exact same event, after the first has fully committed.
            orders_svc.handle_paystack_webhook(
                SessionLocal(), "charge.success", {"reference": reference, "id": "tx-1"}
            )

    order_placed_count = notify_calls.count("order_placed")
    assert order_placed_count == 1, (
        f"Expected exactly 1 order_placed notification across two webhook deliveries, "
        f"got {order_placed_count} (all calls: {notify_calls}) — the order.status == "
        f"'pending' guard in handle_paystack_webhook should have skipped the retry."
    )


def test_add_tracking_retry_does_not_double_notify_order_shipped():
    """2026-07-10 email flow assessment, STEP 3: a retried add_tracking call
    (e.g. a seller double-submitting the tracking form) must not double-send
    order_shipped — add_tracking's existing `order.status != "paid"` guard
    (status is "in_transit" after the first call) already prevents this."""
    import unittest.mock as mock
    from decimal import Decimal
    from app.db.session import SessionLocal
    from app.db.models import Order, OrderItem
    from app.services import orders as orders_svc
    from app.schemas.order import OrderTrackingIn

    order_id = f"order-ship-retry-{uuid4().hex[:8]}"
    seller_id = "user-admin"
    with TestClient(app):
        with SessionLocal() as db:
            db.add(Order(
                id=order_id, user_id="user-admin", status="paid", full_name="Ship Retry Buyer",
                email=f"ship-retry-{uuid4().hex[:6]}@test.com",
                address_line1="1 Test St", city="Accra", state="Greater Accra",
                postal_code="00233", country="Ghana", shipping_method="standard",
                payment_method="card", subtotal=Decimal("100.00"), shipping_cost=Decimal("10.00"),
                tax=Decimal("1.50"), total=Decimal("111.50"), currency="GHS",
                paystack_reference=f"ref-{uuid4().hex[:8]}",
            ))
            db.add(OrderItem(
                id=f"{order_id}-item1", order_id=order_id, seller_id=seller_id,
                name="Test Item", image="/img/t.jpg", price=Decimal("100.00"), quantity=1,
            ))
            db.commit()

        notify_calls: list[str] = []

        def _fake_notify_safe(db, **kwargs):
            notify_calls.append(kwargs.get("event_type"))

        payload = OrderTrackingIn(trackingNumber="TRK123", carrier="DHL")
        with mock.patch.object(orders_svc, "notify_safe", side_effect=_fake_notify_safe):
            with SessionLocal() as db:
                orders_svc.add_tracking(db, order_id, payload, seller_id)

            # Retry: seller resubmits the same tracking form.
            with SessionLocal() as db:
                try:
                    orders_svc.add_tracking(db, order_id, payload, seller_id)
                    raised = False
                except Exception:
                    raised = True

    assert raised, "Expected the retried add_tracking call to be rejected (order no longer 'paid')"
    assert notify_calls.count("order_shipped") == 1


def test_transfer_recipient_type_ghs_uses_ghipss():
    """Bug #3 regression: create_transfer_recipient must produce 'ghipss' (not
    'nuban') for GHS currency — 'nuban' is the Nigerian bank type."""
    import unittest.mock as mock
    from app.services import paystack as paystack_svc

    captured: dict = {}

    def fake_request(method, path, body=None):
        captured["body"] = body or {}
        return {"data": {"recipient_code": "RCP_test123"}}

    with mock.patch.object(paystack_svc, "_request", side_effect=fake_request):
        paystack_svc.create_transfer_recipient(
            name="Kofi Seller",
            account_number="1234567890",
            bank_code="GH123",
            currency="GHS",
        )

    assert captured["body"].get("type") == "ghipss", (
        f"Expected 'ghipss' for GHS currency, got '{captured['body'].get('type')}' — "
        "this would create a Nigerian (NUBAN) recipient and fail all GHS bank payouts"
    )


def test_admin_create_order_recomputes_totals_and_writes_ledger():
    """H8 regression: admin create_order must ignore client prices, check stock,
    decrement stock, and write ledger entries — not trust the client payload."""
    from app.db.session import SessionLocal
    from app.db.models import LedgerEntry, Product

    with TestClient(app) as client:
        # Create a product as admin — seller_id will be the admin user.
        product_payload = _create_product_payload()
        product_payload["stock"] = 10
        product_payload["price"] = 200  # seller lists at 200 GHS
        prod_resp = client.post(
            "/api/v1/products",
            json=product_payload,
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token("user-admin", "admin")},
        )
        assert prod_resp.status_code == 201, prod_resp.text
        product_id = prod_resp.json()["id"]

        # Client sends a manipulated price (1 GHS instead of the real ~216 GHS buyer price).
        order_payload = {
            "userId": None,
            "fullName": "H8 Buyer",
            "email": "h8buyer@test.com",
            "phone": "0240000000",
            "addressLine1": "1 Audit Street",
            "city": "Accra",
            "state": "Greater Accra",
            "postalCode": "00233",
            "country": "Ghana",
            "shippingMethod": "standard",
            "paymentMethod": "card",
            "subtotal": 1.00,      # manipulated — real is ~200+commission
            "shippingCost": 0.00,
            "tax": 0.00,
            "total": 1.00,         # manipulated
            "currency": "GHS",
            "items": [
                {
                    "productId": product_id,
                    "name": product_payload["name"],
                    "image": "/img/test.jpg",
                    "price": 1.00,  # manipulated unit price
                    "quantity": 2,
                    "color": "Sand",
                    "size": "M",
                }
            ],
        }

        resp = client.post(
            "/api/v1/orders",
            json=order_payload,
            headers=ADMIN_HEADERS,
        )
        assert resp.status_code == 201, resp.text
        order = resp.json()

        # Server must have ignored the client prices and recomputed from DB.
        assert order["subtotal"] > 100, "subtotal must be server-computed, not client 1.00"
        assert order["total"] > 100, "total must be server-computed, not client 1.00"
        assert order["status"] == "paid"

        with SessionLocal() as db:
            product = db.get(Product, product_id)
            # Stock must have been decremented.
            assert product.stock == 8, f"Expected stock=8 after qty=2, got {product.stock}"

            # Ledger must have at least a PAYMENT_RECEIVED entry.
            entries = (
                db.query(LedgerEntry)
                .filter(LedgerEntry.order_id == order["id"])
                .all()
            )
            entry_types = {e.entry_type for e in entries}
            assert "PAYMENT_RECEIVED" in entry_types, (
                f"Expected PAYMENT_RECEIVED ledger entry, got: {entry_types}"
            )


def test_add_business_days_skips_weekends():
    """Business-day helper must not count Sat/Sun toward the delivery window."""
    from datetime import timezone
    from app.services.orders import _add_business_days

    # Friday 2026-01-02 + 2 bd → should land on Tuesday 2026-01-06 (skips Sat+Sun).
    friday = datetime(2026, 1, 2, 12, 0, 0, tzinfo=timezone.utc)  # Friday
    result = _add_business_days(friday, 2)
    assert result.weekday() == 1, f"Expected Tuesday (1), got weekday {result.weekday()}"
    assert result.date() == datetime(2026, 1, 6).date(), f"Expected 2026-01-06, got {result.date()}"


def test_add_business_days_same_week():
    """Mid-week advance with no weekend boundary."""
    from datetime import timezone
    from app.services.orders import _add_business_days

    # Monday 2026-01-05 + 3 bd → Thursday 2026-01-08.
    monday = datetime(2026, 1, 5, 8, 0, 0, tzinfo=timezone.utc)
    result = _add_business_days(monday, 3)
    assert result.date() == datetime(2026, 1, 8).date(), f"Expected 2026-01-08, got {result.date()}"


def test_add_business_days_spanning_full_weekend_plus():
    """5 business days from Wednesday should skip one full weekend."""
    from datetime import timezone
    from app.services.orders import _add_business_days

    # Wednesday 2026-01-07 + 5 bd → Wednesday 2026-01-14 (skips Sat 10 + Sun 11).
    wednesday = datetime(2026, 1, 7, 0, 0, 0, tzinfo=timezone.utc)
    result = _add_business_days(wednesday, 5)
    assert result.date() == datetime(2026, 1, 14).date(), f"Expected 2026-01-14, got {result.date()}"


def test_charge_momo_order_gets_estimated_delivery_date():
    """MoMo order created via PAYMENTS_MOCK must have a non-null estimatedDeliveryDate."""
    from app.core.config import settings as svc_settings
    from app.db.session import SessionLocal
    from app.db.models import Order

    with TestClient(app) as client:
        prod_resp = client.post(
            "/api/v1/products",
            json=_create_product_payload(),
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token("user-admin", "admin")},
        )
        assert prod_resp.status_code == 201, prod_resp.text
        product_id = prod_resp.json()["id"]
        price = float(prod_resp.json()["price"])

        original_mock = svc_settings.payments_mock
        svc_settings.payments_mock = True
        try:
            charge_resp = client.post(
                "/api/v1/orders/charge-momo",
                json=_momo_payload(product_id, price),
                headers=INTERNAL_HEADERS,
            )
        finally:
            svc_settings.payments_mock = original_mock

        assert charge_resp.status_code == 201, charge_resp.text
        order_id = charge_resp.json()["orderId"]

        # Submit mock OTP to trigger _mark_order_paid
        svc_settings.payments_mock = True
        reference = charge_resp.json()["reference"]
        try:
            otp_resp = client.post(
                "/api/v1/orders/submit-otp",
                json={"otp": "123456", "reference": reference},
                headers=INTERNAL_HEADERS,
            )
        finally:
            svc_settings.payments_mock = original_mock
        assert otp_resp.status_code == 200, otp_resp.text

    with SessionLocal() as db:
        order = db.get(Order, order_id)
        assert order is not None
        assert order.estimated_delivery_date is not None, (
            "estimatedDeliveryDate must be set after payment"
        )
        assert order.estimated_delivery_days == 5, (
            f"standard method → 5 business days, got {order.estimated_delivery_days}"
        )


def _momo_payload(product_id: str, price: float) -> dict:
    return {
        "fullName": "Kofi Buyer",
        "email": "kofi@test.com",
        "phone": None,
        "addressLine1": "5 Ring Road",
        "addressLine2": None,
        "city": "Accra",
        "state": "Greater Accra",
        "postalCode": "00233",
        "country": "Ghana",
        "shippingMethod": "standard",
        "paymentMethod": "momo",
        "subtotal": price,
        "shippingCost": 12.0,
        "tax": 2.18,
        "total": price + 12.0 + 2.18,
        "currency": "GHS",
        "items": [
            {
                "productId": product_id,
                "name": "Test Item",
                "image": "/img/test.jpg",
                "price": price,
                "quantity": 1,
                "color": None,
                "size": None,
            }
        ],
        "momoPhone": "0551234567",
        "momoProvider": "mtn",
        "idempotencyKey": None,
    }


def test_paystack_client_sends_non_default_user_agent():
    """Paystack HTTP client must use a branded User-Agent to pass Cloudflare's bot check.

    Default Python-urllib and Node user-agents trigger Cloudflare error 1010; this
    test ensures the regression cannot be silently reintroduced.
    """
    from app.services import paystack as ps

    ua = ps._UA
    assert ua, "Paystack _UA must not be empty"
    assert "python" not in ua.lower(), f"Default Python UA detected: {ua!r}"
    assert "node" not in ua.lower(), f"Default Node UA detected: {ua!r}"
    assert "urllib" not in ua.lower(), f"urllib UA would trigger Cloudflare block: {ua!r}"

    client_ua = ps._http.headers.get("user-agent", "")
    assert client_ua == ua, (
        f"httpx client User-Agent {client_ua!r} does not match _UA {ua!r}"
    )


def test_charge_momo_paystack_403_maps_to_403_not_502():
    """Paystack 403 (bad key) must return HTTP 403 with structured error, not 502."""
    from app.services.paystack import PaystackAPIError
    from app.core.config import settings as svc_settings

    with TestClient(app) as client:
        prod_resp = client.post(
            "/api/v1/products",
            json=_create_product_payload(),
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token("user-admin", "admin")},
        )
        assert prod_resp.status_code == 201, prod_resp.text
        product_id = prod_resp.json()["id"]
        price = float(prod_resp.json()["price"])

        # Disable mock mode so the handler actually calls paystack_svc.charge,
        # allowing the patch below to intercept it and simulate a 403.
        original_mock = svc_settings.payments_mock
        svc_settings.payments_mock = False
        try:
            with patch("app.services.orders.paystack_svc.charge",
                       side_effect=PaystackAPIError(403, "Paystack error: Invalid key", "Invalid key")):
                resp = client.post(
                    "/api/v1/orders/charge-momo",
                    json=_momo_payload(product_id, price),
                    headers=INTERNAL_HEADERS,
                )
        finally:
            svc_settings.payments_mock = original_mock

    assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
    body = resp.json()
    detail = body["detail"]
    assert detail["code"] == "paystack_charge_failed"
    assert detail["providerStatus"] == 403
    assert "message" in detail
    assert "providerMessage" in detail


def test_charge_momo_valid_payload_creates_pending_order():
    """Valid MoMo payload with PAYMENTS_MOCK returns send_otp status without hitting Paystack."""
    from app.core.config import settings as svc_settings

    with TestClient(app) as client:
        prod_resp = client.post(
            "/api/v1/products",
            json=_create_product_payload(),
            headers={**INTERNAL_HEADERS, "X-Actor-Token": actor_token("user-admin", "admin")},
        )
        assert prod_resp.status_code == 201, prod_resp.text
        product_id = prod_resp.json()["id"]
        price = float(prod_resp.json()["price"])

        original_mock = svc_settings.payments_mock
        svc_settings.payments_mock = True
        try:
            resp = client.post(
                "/api/v1/orders/charge-momo",
                json=_momo_payload(product_id, price),
                headers=INTERNAL_HEADERS,
            )
        finally:
            svc_settings.payments_mock = original_mock

    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
    body = resp.json()
    assert "orderId" in body
    assert "reference" in body
    assert body["status"] == "send_otp"


# ---------------------------------------------------------------------------
# Payout flow tests (Task B)
# ---------------------------------------------------------------------------

def _create_seller_with_onboarding(client, *, step: int = 5, payout_payload: dict | None = None):
    """Helper: create a seller and advance through onboarding steps 1-N.
    Returns (user_id, headers).
    """
    email = f"seller-payout-{uuid4().hex[:8]}@test.com"
    signup = client.post(
        "/api/v1/auth/signup",
        headers=INTERNAL_HEADERS,
        json={"name": "Kwame Seller", "email": email, "password": "Seller1234!"},
    )
    assert signup.status_code == 201, signup.text
    uid = signup.json()["id"]
    hdrs = {**INTERNAL_HEADERS, "X-Actor-Token": actor_token(uid)}

    # A4: seller onboarding submission requires a verified email — this
    # helper is reused by tests that exercise later-stage submit/payout
    # logic, so verify it directly rather than round-tripping the email flow.
    from app.db.session import SessionLocal
    from app.db.models import User
    with SessionLocal() as db:
        seller = db.get(User, uid)
        seller.email_verified = True
        db.commit()

    # Step 1
    client.patch("/api/v1/auth/onboarding/step/1", headers=hdrs,
                 json={"name": "Kwame Seller", "phone": "0241234567", "termsAccepted": True})
    if step < 2:
        return uid, hdrs
    # Step 2
    client.patch("/api/v1/auth/onboarding/step/2", headers=hdrs,
                 json={"country": "Ghana", "state": "Greater Accra",
                       "city": "Accra", "addressLine1": "1 Seller Lane"})
    if step < 3:
        return uid, hdrs
    # Step 3
    store_name = f"Kwame Store {uuid4().hex[:6]}"
    client.patch("/api/v1/auth/onboarding/step/3", headers=hdrs,
                 json={"storeName": store_name,
                       "storeDescription": "Quality goods from Accra since 2020.",
                       "sellerType": "retail"})
    if step < 4:
        return uid, hdrs
    # Step 4
    client.patch("/api/v1/auth/onboarding/step/4", headers=hdrs,
                 json={"governmentIdType": "ghana-card", "governmentIdNumber": "GHA-123456789-0"})
    if step < 5:
        return uid, hdrs
    # Step 5 (payout)
    if payout_payload is not None:
        r5 = client.patch("/api/v1/auth/onboarding/step/5", headers=hdrs, json=payout_payload)
        return uid, hdrs, r5
    return uid, hdrs


def test_step5_momo_fails_when_paystack_recipient_creation_fails():
    """Step 5 must return 502 when Paystack recipient creation fails for MoMo."""
    import unittest.mock as mock
    from app.services import paystack as paystack_svc
    from app.core.config import settings as svc_settings

    with TestClient(app) as client:
        uid, hdrs = _create_seller_with_onboarding(client, step=4)

        original_key = svc_settings.paystack_secret_key
        svc_settings.paystack_secret_key = "sk_test_fakekeyforfailure"
        try:
            with mock.patch.object(
                paystack_svc, "create_transfer_recipient",
                side_effect=Exception("Paystack unavailable"),
            ):
                r5 = client.patch(
                    "/api/v1/auth/onboarding/step/5",
                    headers=hdrs,
                    json={
                        "method": "mobile_money",
                        "mobileMoneyNetwork": "MTN Mobile Money",
                        "mobileMoneyNumber": "0241234567",
                        "accountName": "Kwame Seller",
                        "currency": "GHS",
                    },
                )
        finally:
            svc_settings.paystack_secret_key = original_key

    assert r5.status_code == 502, (
        f"Expected 502 when Paystack recipient creation fails, got {r5.status_code}: {r5.text}"
    )


def test_step5_bank_fails_when_paystack_recipient_creation_fails():
    """Step 5 must return 502 when Paystack recipient creation fails for bank."""
    import unittest.mock as mock
    from app.services import paystack as paystack_svc
    from app.core.config import settings as svc_settings

    with TestClient(app) as client:
        uid, hdrs = _create_seller_with_onboarding(client, step=4)

        original_key = svc_settings.paystack_secret_key
        svc_settings.paystack_secret_key = "sk_test_fakekeyforfailure"
        try:
            with mock.patch.object(
                paystack_svc, "create_transfer_recipient",
                side_effect=Exception("Bank recipient failed"),
            ):
                r5 = client.patch(
                    "/api/v1/auth/onboarding/step/5",
                    headers=hdrs,
                    json={
                        "method": "bank",
                        "bankCode": "GH130100",
                        "bankName": "GCB Bank",
                        "accountNumber": "1234567890",
                        "accountName": "Kwame Seller",
                        "currency": "GHS",
                    },
                )
        finally:
            svc_settings.paystack_secret_key = original_key

    assert r5.status_code == 502, (
        f"Expected 502 when bank recipient creation fails, got {r5.status_code}: {r5.text}"
    )


def test_submit_onboarding_rejects_without_payout_account():
    """submit_onboarding must 400 if payout_info is missing."""
    from app.db.session import SessionLocal
    from app.db.models import User

    with TestClient(app) as client:
        uid, hdrs = _create_seller_with_onboarding(client, step=4)

        # Manually set onboarding_step=5 and government_id_verified=True without payout_info
        with SessionLocal() as db:
            u = db.get(User, uid)
            u.onboarding_step = 5
            u.government_id_verified = True
            u.payout_info = None
            db.commit()

        resp = client.post("/api/v1/auth/onboarding/submit", headers=hdrs)

    assert resp.status_code == 400, (
        f"Expected 400 when payout_info missing, got {resp.status_code}: {resp.text}"
    )
    assert "payout" in resp.json()["detail"].lower()


def test_submit_onboarding_rejects_without_recipient_code_when_paystack_configured():
    """submit_onboarding must 400 if paystack is configured but recipient_code missing."""
    from app.db.session import SessionLocal
    from app.db.models import User
    from app.services.encryption import encrypt
    from app.core.config import settings as svc_settings
    import json

    with TestClient(app) as client:
        uid, hdrs = _create_seller_with_onboarding(client, step=4)

        # Set up the seller with payout_info but no recipient_code
        payout_plain = {"method": "mobile_money", "mobileMoneyNetwork": "MTN Mobile Money",
                        "mobileMoneyNumber": "0241234567", "accountName": "Kwame", "currency": "GHS"}
        with SessionLocal() as db:
            u = db.get(User, uid)
            u.onboarding_step = 5
            u.government_id_verified = True
            u.payout_info = {"__enc__": encrypt(json.dumps(payout_plain))}
            u.paystack_recipient_code = None
            db.commit()

        original_key = svc_settings.paystack_secret_key
        svc_settings.paystack_secret_key = "sk_test_configured"
        try:
            resp = client.post("/api/v1/auth/onboarding/submit", headers=hdrs)
        finally:
            svc_settings.paystack_secret_key = original_key

    assert resp.status_code == 400, (
        f"Expected 400 when recipient_code missing with Paystack configured, got {resp.status_code}"
    )
    assert "payout" in resp.json()["detail"].lower()


def test_approve_seller_rejects_without_recipient_code():
    """Admin approve_seller must 400 when paystack is configured but no recipient_code."""
    from app.db.session import SessionLocal
    from app.db.models import User
    from app.core.config import settings as svc_settings

    with TestClient(app) as client:
        uid, hdrs = _create_seller_with_onboarding(client, step=4)

        # Put seller in pending_verification without a recipient_code
        with SessionLocal() as db:
            u = db.get(User, uid)
            u.seller_status = "pending_verification"
            u.role = "vendor"
            u.government_id_verified = True
            u.paystack_recipient_code = None
            db.commit()

        original_key = svc_settings.paystack_secret_key
        svc_settings.paystack_secret_key = "sk_test_configured"
        try:
            resp = client.post(
                f"/api/v1/admin/sellers/{uid}/approve",
                headers=ADMIN_HEADERS,
            )
        finally:
            svc_settings.paystack_secret_key = original_key

    assert resp.status_code == 400, (
        f"Expected 400 when approving seller without recipient_code, got {resp.status_code}"
    )
    assert "payout" in resp.json()["detail"].lower()


def test_release_payout_writes_payout_failed_for_missing_recipient():
    """When a confirmed order has a seller with no recipient_code,
    _release_payout must write a PAYOUT_FAILED ledger entry."""
    from decimal import Decimal
    from app.db.session import SessionLocal
    from app.db.models import Order, OrderItem, LedgerEntry, User
    from app.services import ledger as ledger_svc
    from sqlalchemy import select as _sel

    seller_email = f"no-payout-{uuid4().hex[:8]}@test.com"
    order_id = f"order-missing-payout-{uuid4().hex[:8]}"

    with TestClient(app) as client:
        # DB is now initialized by app startup. Create seller + order directly.
        with SessionLocal() as db:
            seller = User(
                id=f"user-nopayout-{uuid4().hex[:8]}",
                name="No Payout Seller",
                email=seller_email,
                password_hash="x",
                role="vendor",
                seller_status="active",
                paystack_recipient_code=None,
                payout_info=None,
            )
            db.add(seller)

            order = Order(
                id=order_id,
                user_id="user-admin",  # so confirm-delivery accepts this actor
                status="delivered",
                full_name="Test Buyer",
                email="buyer@test.com",
                address_line1="1 Test St",
                city="Accra",
                state="Greater Accra",
                postal_code="00233",
                country="Ghana",
                shipping_method="standard",
                payment_method="card",
                subtotal=Decimal("100.00"),
                shipping_cost=Decimal("10.00"),
                tax=Decimal("1.50"),
                total=Decimal("111.50"),
                currency="GHS",
                paystack_reference=f"ref-{uuid4().hex[:8]}",
            )
            db.add(order)
            db.add(OrderItem(
                id=f"{order_id}-item1",
                order_id=order_id,
                seller_id=seller.id,
                name="Test Item",
                image="/img/t.jpg",
                price=Decimal("100.00"),
                quantity=1,
            ))
            db.commit()
            seller_id = seller.id

        resp = client.put(
            f"/api/v1/orders/{order_id}/confirm-delivery",
            headers=ADMIN_HEADERS,
        )
        assert resp.status_code == 200, resp.text

        with SessionLocal() as db:
            failed_entries = db.scalars(
                _sel(LedgerEntry).where(
                    LedgerEntry.order_id == order_id,
                    LedgerEntry.entry_type == ledger_svc.PAYOUT_FAILED,
                    LedgerEntry.seller_id == seller_id,
                )
            ).all()
            assert len(failed_entries) >= 1, (
                "Expected at least one PAYOUT_FAILED ledger entry for seller with no recipient_code"
            )
            assert failed_entries[0].meta.get("reason") == "missing_recipient"


def test_legacy_card_payout_info_decrypts_without_crashing():
    """Legacy payout_info blobs with method='card' must not crash — treated as missing account."""
    from app.db.session import SessionLocal
    from app.db.models import User
    from app.services.encryption import encrypt
    from app.services.auth import _decrypt_payout_info
    import json

    legacy_blob = {
        "method": "card",
        "cardLast4": "4242",
        "cardholderName": "Old User",
        "currency": "GHS",
        "accountName": "Old User",
    }
    encrypted_blob = {"__enc__": encrypt(json.dumps(legacy_blob))}

    # _decrypt_payout_info must return the decrypted dict without raising
    result = _decrypt_payout_info(encrypted_blob)
    assert isinstance(result, dict), "Expected dict from _decrypt_payout_info"
    assert result.get("method") == "card", "Legacy method should be returned as-is"
    # _ensure_recipient_code must return None for method="card" (not crash)
    from app.db.models import User as UserModel
    # We just confirm the decrypt doesn't raise — functional test above covers ensure_recipient_code


def test_bank_recipient_uses_ghipss_type():
    """Regression: create_transfer_recipient must use 'ghipss' type for GHS bank transfers."""
    import unittest.mock as mock
    from app.services import paystack as paystack_svc

    captured: dict = {}

    def fake_request(method, path, body=None):
        captured["body"] = body or {}
        return {"data": {"recipient_code": "RCP_bank_test"}}

    with mock.patch.object(paystack_svc, "_request", side_effect=fake_request):
        paystack_svc.create_transfer_recipient(
            name="Ama Bank",
            account_number="1234567890",
            bank_code="GH130100",
            currency="GHS",
        )

    assert captured["body"].get("type") == "ghipss", (
        f"Bank transfer must use 'ghipss' for GHS, got '{captured['body'].get('type')}'"
    )

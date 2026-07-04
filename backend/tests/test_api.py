import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

# Load the backend .env file so that INTERNAL_KEY matches the running Settings
# instance (which pydantic-settings loads from the same file).
_env_path = Path(__file__).resolve().parents[1] / ".env"
if _env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_path, override=False)

from fastapi.testclient import TestClient

from app.main import app

INTERNAL_KEY = os.environ.get("BACKEND_INTERNAL_API_KEY", "spree-internal-dev-key")
INTERNAL_HEADERS = {"X-Internal-Api-Key": INTERNAL_KEY}
ADMIN_HEADERS = {"X-Internal-Api-Key": INTERNAL_KEY, "X-Actor-Role": "admin"}


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
            headers={**INTERNAL_HEADERS, "X-Actor-User-Id": created_user["id"]},
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
            headers={**INTERNAL_HEADERS, "X-Actor-User-Id": created_user["id"]},
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
            headers={**INTERNAL_HEADERS, "X-Actor-User-Id": created_user["id"]},
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
                "X-Actor-User-Id": "user-admin",
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
                "X-Actor-User-Id": "user-admin",
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
        response = client.get(
            "/api/v1/chat/token",
            headers={**INTERNAL_HEADERS, "X-Actor-User-Id": "user-test-123"},
        )
        # Either 503 (Stream not configured) or 200 (if STREAM_API_KEY is set in test env)
        assert response.status_code in (200, 503)
        if response.status_code == 200:
            data = response.json()
            assert "token" in data
            assert "userId" in data
            assert "channelId" in data
            assert data["channelId"] == "support-user-test-123"
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

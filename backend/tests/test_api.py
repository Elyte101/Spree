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
            headers={**INTERNAL_HEADERS, "X-Actor-User-Id": "user-admin"},
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
            headers={**INTERNAL_HEADERS, "X-Actor-User-Id": "user-admin"},
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

    with TestClient(app) as client:
        prod_resp = client.post(
            "/api/v1/products",
            json=_create_product_payload(),
            headers={**INTERNAL_HEADERS, "X-Actor-User-Id": "user-admin"},
        )
        assert prod_resp.status_code == 201, prod_resp.text
        product_id = prod_resp.json()["id"]
        price = float(prod_resp.json()["price"])

        with patch("app.services.orders.paystack_svc.charge",
                   side_effect=PaystackAPIError(403, "Paystack error: Invalid key", "Invalid key")):
            resp = client.post(
                "/api/v1/orders/charge-momo",
                json=_momo_payload(product_id, price),
                headers=INTERNAL_HEADERS,
            )

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
            headers={**INTERNAL_HEADERS, "X-Actor-User-Id": "user-admin"},
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

from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


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


def test_healthcheck():
    with TestClient(app) as client:
        response = client.get("/healthz")

        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


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
        email = f"seller-{uuid4().hex[:8]}@example.com"
        signup_response = client.post(
            "/api/v1/auth/signup",
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
            headers={"X-Internal-Api-Key": "spree-internal-dev-key"},
            json={
                "name": "Jamie Merchant",
                "email": email,
                "phone": "555-0100",
                "isSeller": True,
                "storeName": "Jamie Select",
                "storeDescription": "Curated essentials for every season.",
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
            },
        )

        assert profile_response.status_code == 200
        payload = profile_response.json()
        assert payload["role"] == "seller"
        assert payload["storeName"] == "Jamie Select"
        assert payload["shippingAddress"]["city"] == "Accra"
        assert payload["paymentInfo"]["cardLast4"] == "4242"


def test_product_details_endpoint_returns_created_product():
    with TestClient(app) as client:
        create_response = client.post(
            "/api/v1/products",
            json=_create_product_payload(),
            headers={"X-Internal-Api-Key": "spree-internal-dev-key"},
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
            headers={"X-Internal-Api-Key": "spree-internal-dev-key"},
        )

        assert response.status_code == 201
        created = response.json()
        assert created["name"] == payload["name"]
        assert created["stock"] == 18
        assert created["discount"] == 12

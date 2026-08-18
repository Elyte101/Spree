"""Idempotency + correctness tests for the one-off backend/scripts/ data
migrations (run_production_migrations.md). Each test manufactures a drift
scenario matching what was found live in production, then proves the full
contract every script promises:

  1. dry-run finds the drift and changes nothing (row count still drifted)
  2. --apply (run(dry_run=False)) fixes it
  3. a second dry-run finds nothing left to do (idempotent)

This is what "idempotency asserted by a test" (rather than just a manually
re-run dry-run someone has to remember to check) means for these scripts.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from sqlalchemy.orm.attributes import flag_modified

from app.db.models import Category, Collection, Product, User
from app.db.session import SessionLocal


def _make_product_with_variants(client, admin_headers, *, colors=None, sizes=None, variants=None, images=None):
    import test_api  # noqa: PLC0415 — reuse the shared fixture payload builder

    payload = test_api._create_product_payload()
    if images is not None:
        payload["images"] = images
    if variants is not None:
        payload["variants"] = variants
    else:
        payload["colors"] = colors if colors is not None else payload["colors"]
        payload["sizes"] = sizes if sizes is not None else payload["sizes"]
    resp = client.post("/api/v1/products", json=payload, headers=admin_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_reconcile_product_stock_is_idempotent():
    from fastapi.testclient import TestClient
    from app.main import app
    import test_api

    import reconcile_product_stock

    with TestClient(app) as client:
        product_id = _make_product_with_variants(client, test_api.ADMIN_HEADERS)

        with SessionLocal() as db:
            product = db.get(Product, product_id)
            product.stock = 99999  # manufacture drift
            db.add(product)
            db.commit()

        dry_rows_1 = reconcile_product_stock.run(dry_run=True)
        assert any(r[0] for r in dry_rows_1)  # something drifted

        applied_rows = reconcile_product_stock.run(dry_run=False)
        assert applied_rows

        dry_rows_2 = reconcile_product_stock.run(dry_run=True)
        assert dry_rows_2 == []


def test_fix_orphaned_variant_images_is_idempotent():
    from fastapi.testclient import TestClient
    from app.main import app
    import test_api

    import fix_orphaned_variant_images

    with TestClient(app) as client:
        product_id = _make_product_with_variants(
            client,
            test_api.ADMIN_HEADERS,
            images=["/products/gallery-a.jpg"],
            variants=[{"label": "Only", "color": "Black", "stock": 5, "image": "/products/gallery-a.jpg"}],
        )
        with SessionLocal() as db:
            product = db.get(Product, product_id)
            product.variants[0]["image"] = "https://stale.example.com/orphan.jpg"
            flag_modified(product, "variants")
            db.add(product)
            db.commit()

        dry_rows_1 = fix_orphaned_variant_images.run(dry_run=True)
        assert dry_rows_1

        fix_orphaned_variant_images.run(dry_run=False)

        dry_rows_2 = fix_orphaned_variant_images.run(dry_run=True)
        assert dry_rows_2 == []

        with SessionLocal() as db:
            product = db.get(Product, product_id)
            assert product.variants[0]["image"] == "/products/gallery-a.jpg"


def test_normalize_variant_colors_is_idempotent():
    from fastapi.testclient import TestClient
    from app.main import app
    import test_api

    import normalize_variant_colors

    with TestClient(app) as client:
        product_id = _make_product_with_variants(client, test_api.ADMIN_HEADERS)

        with SessionLocal() as db:
            product = db.get(Product, product_id)
            product.variants[0]["color"] = "Navy blue"
            flag_modified(product, "variants")
            db.add(product)
            db.commit()

        dry_rows_1 = normalize_variant_colors.run(dry_run=True)
        assert any(r[2] == "Navy blue" for r in dry_rows_1)

        normalize_variant_colors.run(dry_run=False)

        dry_rows_2 = normalize_variant_colors.run(dry_run=True)
        assert dry_rows_2 == []

        with SessionLocal() as db:
            product = db.get(Product, product_id)
            assert product.variants[0]["color"] == "Navy"


def test_normalize_variant_sizes_is_idempotent():
    from fastapi.testclient import TestClient
    from app.main import app
    import test_api

    import normalize_variant_sizes

    with TestClient(app) as client:
        categories = {c["name"]: c for c in client.get("/api/v1/categories").json()}
        payload = test_api._create_product_payload()
        payload["categoryId"] = categories["Fashion & Apparel"]["id"]
        del payload["categoryName"]
        payload["sizes"] = ["S"]
        product_id = client.post("/api/v1/products", json=payload, headers=test_api.ADMIN_HEADERS).json()["id"]

        with SessionLocal() as db:
            product = db.get(Product, product_id)
            product.variants[0]["size"] = "20cm"  # a clean <number><unit>, always reformats
            flag_modified(product, "variants")
            db.add(product)
            db.commit()

        dry_rows_1 = normalize_variant_sizes.run(dry_run=True)
        assert any(r[2] == "20cm" for r in dry_rows_1)

        normalize_variant_sizes.run(dry_run=False)

        dry_rows_2 = normalize_variant_sizes.run(dry_run=True)
        assert dry_rows_2 == []


def test_normalize_product_subcategories_is_idempotent():
    from fastapi.testclient import TestClient
    from app.main import app
    import test_api

    import normalize_product_subcategories

    with TestClient(app) as client:
        categories = {c["name"]: c for c in client.get("/api/v1/categories").json()}
        phones = categories["Phones & Accessories"]

        payload = test_api._create_product_payload()
        payload["name"] = "iPhone 17 Test Unit"
        payload["categoryId"] = phones["id"]
        del payload["categoryName"]
        payload["sizes"] = []  # fixture's default clothing sizes don't validate for Phones & Accessories
        create_resp = client.post("/api/v1/products", json=payload, headers=test_api.ADMIN_HEADERS)
        assert create_resp.status_code == 201, create_resp.text
        product_id = create_resp.json()["id"]

        dry_rows_1 = normalize_product_subcategories.run(dry_run=True)
        assert any(r[0] == payload["name"][:40] for r in dry_rows_1)

        normalize_product_subcategories.run(dry_run=False)

        dry_rows_2 = normalize_product_subcategories.run(dry_run=True)
        assert not any(r[0] == payload["name"][:40] for r in dry_rows_2)

        with SessionLocal() as db:
            product = db.get(Product, product_id)
            assert product.category.name == "Smartphones"


def test_fix_collection_typos_is_idempotent():
    import fix_collection_typos

    with SessionLocal() as db:
        collection = Collection(
            id="collection-typo-test",
            name="Phone accesories",
            slug="phone-accesories",
            description="A USB type C charger fro iPhone and android devices",
            image="/collections/test.jpg",
        )
        db.add(collection)
        db.commit()

    try:
        dry_rows_1 = fix_collection_typos.run(dry_run=True)
        assert dry_rows_1

        fix_collection_typos.run(dry_run=False)

        dry_rows_2 = fix_collection_typos.run(dry_run=True)
        assert dry_rows_2 == []

        with SessionLocal() as db:
            collection = db.get(Collection, "collection-typo-test")
            assert collection.slug == "phone-accessories"
            assert collection.name == "Phone Accessories"
            assert "fro iPhone" not in collection.description
    finally:
        with SessionLocal() as db:
            collection = db.get(Collection, "collection-typo-test")
            if collection:
                db.delete(collection)
                db.commit()


def test_backfill_seller_store_identity_is_idempotent():
    import backfill_seller_store_identity

    dry_rows_1 = backfill_seller_store_identity.run(dry_run=True)
    # The seeded admin account has no store_name until onboarding/backfill.
    assert any(r[0] == "user-admin" for r in dry_rows_1)

    backfill_seller_store_identity.run(dry_run=False)

    dry_rows_2 = backfill_seller_store_identity.run(dry_run=True)
    assert not any(r[0] == "user-admin" for r in dry_rows_2)

    with SessionLocal() as db:
        admin = db.get(User, "user-admin")
        assert admin.store_name
        assert admin.store_slug

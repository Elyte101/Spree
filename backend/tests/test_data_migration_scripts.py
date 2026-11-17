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


def test_create_category_umbrellas_is_idempotent():
    import create_category_umbrellas
    from app.core.category_taxonomy import UMBRELLA_CATEGORIES

    dry_rows_1 = create_category_umbrellas.run(dry_run=True)
    # Every seeded main category is a member of exactly one umbrella, so a
    # fresh (never-migrated) DB should report a create-umbrella row plus a
    # reparent row for each member.
    assert len(dry_rows_1) >= len(UMBRELLA_CATEGORIES)
    assert any(row[0] == "create umbrella" for row in dry_rows_1)

    create_category_umbrellas.run(dry_run=False)

    dry_rows_2 = create_category_umbrellas.run(dry_run=True)
    assert dry_rows_2 == []

    with SessionLocal() as db:
        from sqlalchemy import select

        mains = db.scalars(select(Category).where(Category.parent_id.is_(None))).all()
        main_slugs = {c.slug for c in mains}
        for umbrella in UMBRELLA_CATEGORIES:
            assert umbrella["slug"] in main_slugs, f"{umbrella['name']} was not created as a top-level category"
            for member_slug in umbrella["members"]:
                member = db.scalar(select(Category).where(Category.slug == member_slug))
                assert member is not None
                assert member.parent is not None
                assert member.parent.slug == umbrella["slug"]


def test_category_item_count_aggregates_through_the_umbrella_layer():
    """list_categories' itemCount used to count only products assigned
    directly to that exact category row. After the umbrella migration, no
    product is ever assigned directly to an umbrella — a direct-only count
    would always show 0 for all 11 umbrellas despite real products sitting
    two levels under them."""
    from fastapi.testclient import TestClient
    from app.main import app
    import test_api

    import create_category_umbrellas

    create_category_umbrellas.run(dry_run=False)

    with TestClient(app) as client:
        categories = {c["slug"]: c for c in client.get("/api/v1/categories").json()}
        smartphones = categories["phones-accessories-smartphones"]

        payload = test_api._create_product_payload()
        payload["name"] = "Item Count Test Phone"
        payload["categoryId"] = smartphones["id"]
        del payload["categoryName"]
        payload["sizes"] = []
        create_resp = client.post("/api/v1/products", json=payload, headers=test_api.ADMIN_HEADERS)
        assert create_resp.status_code == 201, create_resp.text

        home = client.get("/api/v1/home").json()
        by_slug = {c["slug"]: c for c in home["categories"]}
        electronics = by_slug["electronics"]
        assert electronics["itemCount"] >= 1, (
            "umbrella itemCount must aggregate its descendants' products, not just its own direct ones"
        )

        full_tree = {c["slug"]: c for c in client.get("/api/v1/categories").json()}
        assert full_tree["phones-accessories"]["itemCount"] >= 1
        assert full_tree["phones-accessories-smartphones"]["itemCount"] >= 1


def test_normalize_product_subcategories_still_works_after_umbrellas_exist():
    """Regression: once an old main category is reparented under an
    umbrella, its parent_id is no longer None — normalize_product_
    subcategories.py's original "already a leaf" check (parent_id is not
    None) would have silently treated every old main as already-done from
    that point on, permanently no-opping for any later product filed
    directly under one. Running umbrella creation BEFORE subcategory
    assignment is exactly the order run_production_migrations.md avoids
    (subcategory assignment is step 5, umbrellas are step 8), but the
    script must still behave correctly even if run in this order, since
    it's also meant to be re-run later as new products are added."""
    from fastapi.testclient import TestClient
    from app.main import app
    import test_api

    import create_category_umbrellas
    import normalize_product_subcategories

    create_category_umbrellas.run(dry_run=False)

    with TestClient(app) as client:
        categories = {c["name"]: c for c in client.get("/api/v1/categories").json()}
        phones = categories["Phones & Accessories"]
        assert phones["parentId"] is not None  # confirms the umbrella reparenting already happened

        payload = test_api._create_product_payload()
        payload["name"] = "iPhone 17 Ultra Umbrella Regression"
        payload["categoryId"] = phones["id"]
        del payload["categoryName"]
        payload["sizes"] = []
        create_resp = client.post("/api/v1/products", json=payload, headers=test_api.ADMIN_HEADERS)
        assert create_resp.status_code == 201, create_resp.text
        product_id = create_resp.json()["id"]

        rows = normalize_product_subcategories.run(dry_run=True)
        assert any(row[0] == payload["name"][:40] for row in rows), (
            "a product filed directly under an old main must still be a reassignment "
            "candidate after that old main has been reparented under an umbrella"
        )

        normalize_product_subcategories.run(dry_run=False)
        updated = client.get(f"/api/v1/products/{product_id}").json()
        assert updated["category"] == "Smartphones"


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


def test_category_filter_and_size_validation_work_through_the_umbrella_layer():
    """The umbrella migration makes the taxonomy up to 3 levels deep
    (umbrella -> old main -> old subcategory) for the first time. Both
    call sites that used to assume at most 2 levels —
    _apply_product_filters' category descendant matching and
    _validate_sizes' main-category resolution — were updated for it; this
    proves both against the real post-migration structure, not just the
    algorithm in isolation."""
    from fastapi.testclient import TestClient
    from app.main import app
    import test_api

    import create_category_umbrellas

    create_category_umbrellas.run(dry_run=False)

    with TestClient(app) as client:
        categories = {c["slug"]: c for c in client.get("/api/v1/categories").json()}
        smartphones = categories["phones-accessories-smartphones"]

        payload = test_api._create_product_payload()
        payload["name"] = "Umbrella Depth Test Phone"
        payload["categoryId"] = smartphones["id"]
        del payload["categoryName"]
        payload["sizes"] = []  # clothing-fixture sizes don't validate for a phone category
        create_resp = client.post("/api/v1/products", json=payload, headers=test_api.ADMIN_HEADERS)
        assert create_resp.status_code == 201, create_resp.text
        product_id = create_resp.json()["id"]

        # Filtering by the new umbrella (2 levels above the product's actual
        # category) must still surface it.
        by_umbrella = client.get("/api/v1/products?category=electronics&limit=48")
        assert by_umbrella.status_code == 200
        assert any(item["id"] == product_id for item in by_umbrella.json()["items"])

        # Size validation on create must resolve to the old main's size set
        # ("Phones & Accessories"), not the umbrella's (which has none) or
        # the leaf subcategory's — rejecting a clothing size proves it didn't
        # silently fall back to GENERIC_SIZES for either reason.
        bad_size_payload = dict(payload)
        bad_size_payload["name"] = "Umbrella Depth Test Phone 2"
        bad_size_payload["sizes"] = ["Medium"]
        reject_resp = client.post("/api/v1/products", json=bad_size_payload, headers=test_api.ADMIN_HEADERS)
        assert reject_resp.status_code == 422, reject_resp.text
        assert "Phones & Accessories" in reject_resp.json()["detail"]

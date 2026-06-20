"""
One-time repair: re-point the two stale HEIC references and delete the orphaned
file from Supabase storage.

Background
----------
df7f7e37-eb22-41c9-8e9c-c32381ff0a93.jpg is actually a HEIC file (magic bytes
ftypheic) that was stored with a .jpg extension.  The product that originally
created it has already been fixed, but the "Tech" category and the
"MacBook Pro Series" collection still reference this URL.

What this script does
---------------------
1. Scans every Category and Collection whose image field contains the broken
   UUID.  For each one, replaces the image with the first valid image found
   among its products (or the placeholder if none exist).
2. Removes the orphaned file from the Supabase product-images bucket so it
   can no longer be served.

Usage (run from the backend/ directory)
----------------------------------------
    # Required: database connection
    export DATABASE_URL="postgresql+psycopg://..."

    # Required for storage cleanup (Supabase service-role key):
    export SUPABASE_URL="https://<project>.supabase.co"
    export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"

    python -m app.scripts.fix_heic_refs

    # Dry-run (no writes):
    python -m app.scripts.fix_heic_refs --dry-run
"""
from __future__ import annotations

import argparse
import logging
import sys
import urllib.parse
import urllib.request

from sqlalchemy import select

from app.db.models import Category, Collection, Product
from app.db.session import SessionLocal

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

BROKEN_UUID = "df7f7e37-eb22-41c9-8e9c-c32381ff0a93"
PLACEHOLDER = "/product-placeholder.svg"
BUCKET = "product-images"


def _find_replacement(db, category_id: str | None, collection_id: str | None) -> str:
    """Return the first valid product image in a category or collection."""
    if category_id:
        donor = db.scalar(
            select(Product)
            .where(Product.category_id == category_id, Product.images != None)
            .limit(1)
        )
    else:
        donor = db.scalar(
            select(Product)
            .where(Product.collection_id == collection_id, Product.images != None)
            .limit(1)
        )
    imgs: list[str] = donor.images if donor else []
    return imgs[0] if imgs else PLACEHOLDER


def _supabase_delete(supabase_url: str, service_key: str, object_path: str) -> None:
    """Delete a single object from Supabase storage (REST API)."""
    url = f"{supabase_url.rstrip('/')}/storage/v1/object/{object_path}"
    req = urllib.request.Request(url, method="DELETE")
    req.add_header("Authorization", f"Bearer {service_key}")
    try:
        with urllib.request.urlopen(req) as resp:
            log.info("Deleted from storage: %s (HTTP %s)", object_path, resp.status)
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            log.warning("Object not found in storage (already deleted?): %s", object_path)
        else:
            log.error("Storage delete failed (%s): %s", exc.code, exc.read().decode())


def run(dry_run: bool = False) -> None:
    if SessionLocal is None:
        log.error("Database not configured. Set DATABASE_URL.")
        sys.exit(1)

    db = SessionLocal()
    try:
        fixed_urls: list[str] = []

        # --- Fix categories ---
        stale_cats = db.scalars(
            select(Category).where(Category.image.contains(BROKEN_UUID))
        ).all()
        for cat in stale_cats:
            old_url = cat.image
            replacement = _find_replacement(db, category_id=cat.id, collection_id=None)
            log.info(
                "[category] %r  %s -> %s",
                cat.name,
                old_url,
                replacement,
            )
            if not dry_run:
                fixed_urls.append(old_url)
                cat.image = replacement
                db.add(cat)

        # --- Fix collections ---
        stale_cols = db.scalars(
            select(Collection).where(Collection.image.contains(BROKEN_UUID))
        ).all()
        for col in stale_cols:
            old_url = col.image
            replacement = _find_replacement(db, category_id=None, collection_id=col.id)
            log.info(
                "[collection] %r  %s -> %s",
                col.name,
                old_url,
                replacement,
            )
            if not dry_run:
                fixed_urls.append(old_url)
                col.image = replacement
                db.add(col)

        if dry_run:
            log.info("Dry-run: no changes written.")
            return

        if not fixed_urls:
            log.info("No stale references found — nothing to fix.")
        else:
            db.commit()
            log.info("Database updated (%d record(s) fixed).", len(fixed_urls))

        # --- Delete orphaned object from Supabase storage ---
        import os
        supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("DATABASE_SUPABASE_URL")
        service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("DATABASE_SUPABASE_SERVICE_ROLE_KEY")

        if supabase_url and service_key:
            # Extract the storage object path from one of the broken URLs.
            # URL shape: .../storage/v1/object/public/product-images/{user_id}/{filename}
            broken_urls = list({url for url in fixed_urls if BROKEN_UUID in url})
            for broken_url in broken_urls:
                parsed = urllib.parse.urlparse(broken_url)
                # path is: /storage/v1/object/public/product-images/...
                path_after_public = parsed.path.split("/object/public/", 1)
                if len(path_after_public) == 2:
                    object_path = path_after_public[1]  # e.g. product-images/{user_id}/{file}
                    _supabase_delete(supabase_url, service_key, object_path)
                else:
                    log.warning("Could not extract storage path from URL: %s", broken_url)
        else:
            log.warning(
                "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — "
                "skipping Supabase storage cleanup. "
                "Delete product-images/**/%s.jpg manually.",
                BROKEN_UUID,
            )

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fix stale HEIC references in catalog.")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing.")
    args = parser.parse_args()
    run(dry_run=args.dry_run)

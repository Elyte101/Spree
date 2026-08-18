"""
One-off backfill: every vendor/admin account that can own products needs a
store_name + unique store_slug, or the public seller profile (/seller/[slug],
GET /sellers/{id}/summary) can never resolve them (_resolve_seller in
app/services/marketplace.py requires store_name IS NOT NULL) — which is why
"Sold by <name>" on product pages renders as plain unlinked text and
storeName/storeSlug come back null in the products API for every product
owned by an account that never went through vendor onboarding (e.g. the
seed admin account).

Only fills accounts with store_name IS NULL — never overwrites an existing
store name/slug a vendor already set for themselves via onboarding.

Slug derivation: slugify(display name), e.g. "Lyte" -> "lyte". On collision
with an existing store_slug, append -2, -3, ... until unique.

Run from the backend directory:
    python scripts/backfill_seller_store_identity.py [--dry-run]
"""

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.db.models import User
from app.db.session import SessionLocal


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower().strip()).strip("-")
    return slug or "seller"


def _unique_slug(base: str, taken: set[str]) -> str:
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"


def run(dry_run: bool = False) -> None:
    with SessionLocal() as db:
        all_slugs = {
            s for s in db.scalars(select(User.store_slug).where(User.store_slug.is_not(None))).all()
        }

        candidates = db.scalars(
            select(User).where(User.role.in_(["vendor", "admin"]), User.store_name.is_(None))
        ).all()

        if not candidates:
            print("No accounts need a store identity backfill.")
            return

        filled = 0
        for user in candidates:
            base_name = (user.name or "").strip() or user.id
            slug = _unique_slug(_slugify(base_name), all_slugs)
            all_slugs.add(slug)

            print(f"  {'[DRY] ' if dry_run else ''}SET user={user.id} storeName={base_name!r} storeSlug={slug!r}")
            if not dry_run:
                user.store_name = base_name
                user.store_slug = slug
                db.add(user)
            filled += 1

        if not dry_run:
            db.commit()

    verb = "Would fill" if dry_run else "Filled"
    print(f"\n{verb} store identity for {filled} account(s).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill store_name/store_slug for vendor/admin accounts missing them.")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing.")
    args = parser.parse_args()
    run(dry_run=args.dry_run)

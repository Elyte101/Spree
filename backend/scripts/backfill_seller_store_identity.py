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

Idempotent: the candidate query filters store_name IS NULL — once filled, an
account can never be a candidate again, so a second run always reports zero
candidates.

Run from the backend directory:
    python scripts/backfill_seller_store_identity.py             # dry-run (default)
    python scripts/backfill_seller_store_identity.py --apply      # actually write
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend/ — for app.*
sys.path.insert(0, str(Path(__file__).resolve().parent))  # scripts/ — for _migration_lib

from sqlalchemy import select

from _migration_lib import build_arg_parser, print_table, resolve_dry_run
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


def run(dry_run: bool = True) -> list[tuple[str, str, str]]:
    """Returns the list of (user_id, storeName, storeSlug) rows filled/found."""
    rows: list[tuple[str, str, str]] = []

    with SessionLocal() as db:
        all_slugs = {
            s for s in db.scalars(select(User.store_slug).where(User.store_slug.is_not(None))).all()
        }

        candidates = db.scalars(
            select(User).where(User.role.in_(["vendor", "admin"]), User.store_name.is_(None))
        ).all()

        for user in candidates:
            base_name = (user.name or "").strip() or user.id
            slug = _unique_slug(_slugify(base_name), all_slugs)
            all_slugs.add(slug)

            rows.append((user.id, base_name, slug))
            if not dry_run:
                user.store_name = base_name
                user.store_slug = slug
                db.add(user)

        if not dry_run:
            db.commit()

    print_table(["user_id", "storeName", "storeSlug"], rows)
    verb = "Would fill" if dry_run else "Filled"
    print(f"\n{verb} store identity for {len(rows)} account(s).")
    return rows


if __name__ == "__main__":
    parser = build_arg_parser("Backfill store_name/store_slug for vendor/admin accounts missing them.")
    args = parser.parse_args()
    run(dry_run=resolve_dry_run(args))

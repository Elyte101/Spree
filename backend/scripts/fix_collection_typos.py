"""
One-off cleanup: fix known typos in Collection rows.

  - "Phone accesories" / slug "phone-accesories"
    -> "Phone Accessories" / slug "phone-accessories"
  - description "...fro iPhone and android devices"
    -> "...for iPhone and Android devices"

The slug is a public URL parameter (/products?collection=<slug>) — renaming
it without a redirect would 404/silently-empty-filter existing shared links.
next.config.ts carries a query-param redirect for the old slug (see the
/login-style redirect added there), so this script only needs to fix the DB
row; it does not need to preserve the old slug as a second alias.

Run from the backend directory:
    python scripts/fix_collection_typos.py [--dry-run]
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.db.models import Collection
from app.db.session import SessionLocal

# (old_slug, new_name, new_slug)
_SLUG_RENAMES = [
    ("phone-accesories", "Phone Accessories", "phone-accessories"),
]

# Plain substring replacements, applied to every collection's description.
_TEXT_FIXES = [
    ("fro iPhone and android devices", "for iPhone and Android devices"),
    ("---", ""),
]


def run(dry_run: bool = False) -> None:
    changed = 0

    with SessionLocal() as db:
        collections = db.scalars(select(Collection)).all()

        for old_slug, new_name, new_slug in _SLUG_RENAMES:
            match = next((c for c in collections if c.slug == old_slug), None)
            if match is None:
                continue
            print(f"  {'[DRY] ' if dry_run else ''}RENAME collection {match.id}: "
                  f"{match.name!r}/{match.slug!r} -> {new_name!r}/{new_slug!r}")
            if not dry_run:
                match.name = new_name
                match.slug = new_slug
                db.add(match)
            changed += 1

        for collection in collections:
            original = collection.description or ""
            fixed = original
            for old, new in _TEXT_FIXES:
                fixed = fixed.replace(old, new)
            fixed = " ".join(fixed.split())  # collapse whitespace left by "---" removal
            if fixed != original:
                print(f"  {'[DRY] ' if dry_run else ''}FIX description on {collection.id} ({collection.slug}): "
                      f"{original!r} -> {fixed!r}")
                if not dry_run:
                    collection.description = fixed
                    db.add(collection)
                changed += 1

        if not dry_run:
            db.commit()

    verb = "Would change" if dry_run else "Changed"
    print(f"\n{verb} {changed} collection field(s).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fix known typos in Collection name/slug/description.")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing.")
    args = parser.parse_args()
    run(dry_run=args.dry_run)

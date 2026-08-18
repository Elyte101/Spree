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
row; it does not need to preserve the old slug as a second alias. Confirm
the redirect is deployed BEFORE running this with --apply — see
run_production_migrations.md.

Idempotent: the slug rename is looked up by the OLD slug, which no longer
matches after the rename; the text fixes are string replacements that are
no-ops against already-fixed text. A second run finds nothing to change.

Run from the backend directory:
    python scripts/fix_collection_typos.py             # dry-run (default)
    python scripts/fix_collection_typos.py --apply      # actually write
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend/ — for app.*
sys.path.insert(0, str(Path(__file__).resolve().parent))  # scripts/ — for _migration_lib

from sqlalchemy import select

from _migration_lib import build_arg_parser, print_table, resolve_dry_run
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


def run(dry_run: bool = True) -> list[tuple[str, str, str, str]]:
    """Returns the list of (field, id, before, after) rows changed/found."""
    rows: list[tuple[str, str, str, str]] = []

    with SessionLocal() as db:
        collections = db.scalars(select(Collection)).all()

        for old_slug, new_name, new_slug in _SLUG_RENAMES:
            match = next((c for c in collections if c.slug == old_slug), None)
            if match is None:
                continue
            rows.append(("name/slug", match.id, f"{match.name!r}/{match.slug!r}", f"{new_name!r}/{new_slug!r}"))
            if not dry_run:
                match.name = new_name
                match.slug = new_slug
                db.add(match)

        for collection in collections:
            original = collection.description or ""
            fixed = original
            for old, new in _TEXT_FIXES:
                fixed = fixed.replace(old, new)
            fixed = " ".join(fixed.split())  # collapse whitespace left by "---" removal
            if fixed != original:
                rows.append(("description", collection.id, original, fixed))
                if not dry_run:
                    collection.description = fixed
                    db.add(collection)

        if not dry_run:
            db.commit()

    print_table(["field", "collection_id", "before", "after"], rows)
    verb = "Would change" if dry_run else "Changed"
    print(f"\n{verb} {len(rows)} collection field(s).")
    return rows


if __name__ == "__main__":
    parser = build_arg_parser("Fix known typos in Collection name/slug/description.")
    args = parser.parse_args()
    run(dry_run=resolve_dry_run(args))

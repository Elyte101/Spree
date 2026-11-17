"""
One-off + re-runnable: create the 11 top-level "umbrella" categories
(app/core/category_taxonomy.py) and reparent the marketplace's 24 existing
main categories underneath them, so the storefront's main-category chips
(GET /categories?main_only / the homepage filter row) show 11 entries
instead of 24.

Nothing about an existing category's own name, slug, subcategories, or
product assignments changes — this only ever touches:
  - creates up to 11 new Category rows (the umbrellas), skipped if a row
    with that slug already exists (idempotent — see below)
  - sets `parent_id` on each of the 24 existing main categories to point at
    its umbrella

Two umbrellas ("Home & Living", "Automotive") would otherwise collide with
an existing main category's own name/slug (both columns are globally
unique) — resolved by giving every umbrella name an emoji prefix, which no
existing category has. See category_taxonomy.py's module docstring.

Idempotent: an umbrella is looked up by slug before creating it (never
duplicated), and a member whose parent_id already equals its umbrella's id
produces no row on a second pass.

This changes app.services.catalog._validate_sizes' and
_apply_product_filters' category-depth assumptions (now up to 3 levels) —
both were updated accordingly; see their docstrings. Run the backend test
suite after applying this in any environment that hasn't already deployed
that code.

Run from the backend directory:
    python scripts/create_category_umbrellas.py             # dry-run (default)
    python scripts/create_category_umbrellas.py --apply      # actually write
"""

import sys
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend/ — for app.*
sys.path.insert(0, str(Path(__file__).resolve().parent))  # scripts/ — for _migration_lib

from sqlalchemy import select

from _migration_lib import build_arg_parser, print_table, resolve_dry_run
from app.core.category_taxonomy import UMBRELLA_CATEGORIES
from app.db.models import Category
from app.db.session import SessionLocal


def run(dry_run: bool = True) -> list[tuple[str, str, str, str]]:
    """Returns the list of (kind, member/umbrella, before, after) rows changed/found."""
    rows: list[tuple[str, str, str, str]] = []
    flagged: list[tuple[str, str, str]] = []

    with SessionLocal() as db:
        by_slug = {c.slug: c for c in db.scalars(select(Category)).all()}

        for umbrella_def in UMBRELLA_CATEGORIES:
            umbrella = by_slug.get(umbrella_def["slug"])

            if umbrella is None:
                # Borrow an image from the first member that already has one
                # — new Category rows require a non-null image, and there's
                # no dedicated umbrella artwork yet.
                donor_image = next(
                    (by_slug[s].image for s in umbrella_def["members"] if s in by_slug and by_slug[s].image),
                    "/product-placeholder.svg",
                )
                rows.append(("create umbrella", umbrella_def["name"], "(does not exist)", umbrella_def["slug"]))
                if not dry_run:
                    umbrella = Category(
                        id=f"cat-{uuid4().hex[:12]}",
                        name=umbrella_def["name"],
                        slug=umbrella_def["slug"],
                        image=donor_image,
                        parent_id=None,
                    )
                    db.add(umbrella)
                    db.flush()
                    by_slug[umbrella_def["slug"]] = umbrella

            for member_slug in umbrella_def["members"]:
                member = by_slug.get(member_slug)
                if member is None:
                    flagged.append((umbrella_def["name"], member_slug, "no category with this slug exists"))
                    continue
                if umbrella is None:
                    # dry-run, umbrella doesn't exist yet — report what WOULD happen.
                    current_parent = "(top-level)" if member.parent_id is None else "(already a subcategory!)"
                    rows.append((f"reparent -> {umbrella_def['name']}", member.name, current_parent, umbrella_def["name"]))
                    continue
                if member.parent_id == umbrella.id:
                    continue  # already correctly parented — idempotent no-op
                before = "(top-level)" if member.parent_id is None else "(already a subcategory!)"
                rows.append((f"reparent -> {umbrella_def['name']}", member.name, before, umbrella_def["name"]))
                if not dry_run:
                    member.parent_id = umbrella.id
                    db.add(member)

        if not dry_run:
            db.commit()

    print_table(["action", "category", "before", "after"], rows)
    if flagged:
        print("\nFlagged for manual review (left unchanged):")
        print_table(["umbrella", "missing slug", "reason"], flagged)

    verb = "Would apply" if dry_run else "Applied"
    print(f"\n{verb} {len(rows)} change(s); {len(flagged)} flagged for manual review.")
    return rows


if __name__ == "__main__":
    parser = build_arg_parser("Create the 11 umbrella categories and reparent the 24 existing main categories under them.")
    args = parser.parse_args()
    run(dry_run=resolve_dry_run(args))

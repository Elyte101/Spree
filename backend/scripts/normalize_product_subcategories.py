"""
One-off cleanup: products filed directly under a top-level (main) category
that has subcategories, when the product actually belongs in one of them
(e.g. "iPhone 17 Pro Max" filed under "Phones & Accessories" instead of its
"Smartphones" subcategory). This is why categoryParent/categoryParentSlug
come back null on every product in the API — a product's categoryParent is
only ever set when its assigned category itself has a parent (see
_product_to_dict in app/services/catalog.py), so as long as products sit at
the main-category level the two-level relationship exists in the taxonomy
but is never actually exercised by real data.

Matching is a curated keyword table (below), not fuzzy/automatic string
matching — "iPhone" -> Smartphones is domain knowledge a human filled in,
not a guess a script inferred on its own. A product only gets reassigned
when exactly one subcategory's keywords match; zero or multiple matches are
logged as NEEDS_REVIEW and left untouched. The keyword table only covers
subcategories with a very unambiguous product-name signal; add more entries
here as needed rather than loosening the matching to compensate.

Run from the backend directory:
    python scripts/normalize_product_subcategories.py [--dry-run]
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.models import Category, Product
from app.db.session import SessionLocal

# subcategory name -> keywords checked against the product name, case-insensitive.
# Only add an entry here when the keyword is essentially unambiguous for that
# subcategory — this table is deliberately short.
KEYWORDS_BY_SUBCATEGORY: dict[str, list[str]] = {
    # Phones & Accessories
    "Smartphones": ["iphone", "galaxy s", "galaxy note", "galaxy a", "pixel phone", "smartphone"],
    "Chargers & Cables": ["charger", "charging cable", "usb-c cable", "lightning cable", "power adapter"],
    "Power Banks": ["power bank", "powerbank", "portable battery"],
    "Headphones & Earbuds": ["earbuds", "earphone", "headphone", "airpods"],
    "Phone Cases": ["phone case", "iphone case", "case for"],
    "Screen Protectors": ["screen protector", "tempered glass"],
    # Tech
    "Computers & Tablets": ["macbook", "laptop", "notebook pc", "ipad", "tablet", "chromebook", "desktop pc"],
    "Wearable Tech": ["smartwatch", "smart watch", "fitness tracker", "apple watch"],
    "Networking Equipment": ["router", "wifi extender", "access point", "modem"],
    "Smart Home Devices": ["smart bulb", "smart plug", "smart speaker", "video doorbell"],
}


def _keyword_matches(name_lower: str, subcategory_name: str) -> bool:
    keywords = KEYWORDS_BY_SUBCATEGORY.get(subcategory_name)
    if not keywords:
        return False
    return any(kw in name_lower for kw in keywords)


def run(dry_run: bool = False) -> None:
    changed = 0
    flagged = 0
    skipped_leaf = 0

    with SessionLocal() as db:
        categories = db.scalars(select(Category)).all()
        children_by_parent: dict[str, list[Category]] = {}
        for cat in categories:
            if cat.parent_id:
                children_by_parent.setdefault(cat.parent_id, []).append(cat)

        products = db.scalars(
            select(Product).options(selectinload(Product.category))
        ).all()

        for product in products:
            category = product.category
            if category is None or category.parent_id is not None:
                # Already a subcategory (or no category at all) — nothing to do.
                skipped_leaf += 1
                continue

            children = children_by_parent.get(category.id, [])
            if not children:
                # Main category has no subcategories to move into.
                skipped_leaf += 1
                continue

            name_lower = product.name.lower()
            matches = [c for c in children if _keyword_matches(name_lower, c.name)]

            if len(matches) != 1:
                reason = "no keyword match" if not matches else f"ambiguous ({', '.join(m.name for m in matches)})"
                print(
                    f"  {'[DRY] ' if dry_run else ''}FLAG  {product.name!r} ({product.slug}) "
                    f"still under main category {category.name!r}: {reason}"
                )
                flagged += 1
                continue

            target = matches[0]
            print(
                f"  {'[DRY] ' if dry_run else ''}SET   {product.name!r} ({product.slug}) "
                f"{category.name!r} -> {target.name!r}"
            )
            if not dry_run:
                product.category_id = target.id
                db.add(product)
            changed += 1

        if not dry_run:
            db.commit()

    verb = "Would move" if dry_run else "Moved"
    print(
        f"\n{verb} {changed} product(s) into a subcategory; {flagged} flagged for manual review; "
        f"{skipped_leaf} already at a leaf/no-subcategory category."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Move products from a main category into a matching subcategory.")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing.")
    args = parser.parse_args()
    run(dry_run=args.dry_run)

"""
One-off cleanup: normalize free-typed `color` values inside Product.variants
to the canonical set sellers now pick from (lib/productTaxonomy.ts COLOR_OPTIONS,
mirrored below since there's no shared source across the TypeScript/Python split
— see normalize_variant_sizes.py for the same caveat on sizes).

Per-value decision, in order:
  1. Already an exact (case-sensitive) match -> unchanged, "already canonical".
  2. Case-insensitive match to a canonical value (e.g. "navy" -> "Navy",
     "GOLD" -> "Gold") -> re-cased to the canonical spelling.
  3. A known synonym (e.g. "Navy blue" -> "Navy", "Ash" -> "Gray",
     "Light grey" -> "Gray") -> mapped explicitly. This list is intentionally
     short and hand-picked from the actual bad values seen in the wild — no
     fuzzy/nearest-match guessing, since color synonymy isn't something you
     can safely infer from string distance ("Red" and "Bed" are close; "Navy"
     and "Sky" are not, but "Navy" and "Royal" both mean blue).
  4. Anything else -> NEEDS_REVIEW, never written, only logged.

Run from the backend directory:
    python scripts/normalize_variant_colors.py [--dry-run]
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app.db.models import Product
from app.db.session import SessionLocal

# Mirrors lib/productTaxonomy.ts COLOR_OPTIONS — keep in sync manually.
CANONICAL_COLORS = [
    "Black", "White", "Gray", "Silver", "Gold",
    "Red", "Maroon", "Pink", "Orange", "Yellow",
    "Green", "Olive", "Teal", "Turquoise", "Blue", "Navy",
    "Purple", "Lavender", "Brown", "Beige", "Cream",
    "Multicolor", "Ankara Print", "Kente Print",
]
_CANONICAL_LOWER = {c.lower(): c for c in CANONICAL_COLORS}

# Hand-picked synonyms seen in live data. Left-hand side is matched
# case-insensitively; only exact known synonyms are mapped — no guessing.
_SYNONYMS = {
    "navy blue": "Navy",
    "ash": "Gray",
    "light grey": "Gray",
    "light gray": "Gray",
    "grey": "Gray",
    "dark grey": "Gray",
    "charcoal": "Gray",
    "sky blue": "Blue",
    "royal blue": "Blue",
    "wine": "Maroon",
    "burgundy": "Maroon",
    "off white": "White",
    "off-white": "White",
    "ivory": "Cream",
    "tan": "Beige",
    "khaki": "Beige",
    "rose gold": "Gold",
    "multi": "Multicolor",
    "multi-color": "Multicolor",
    "multi color": "Multicolor",
    "assorted": "Multicolor",
}


def normalize_one(raw: str) -> tuple[str | None, str]:
    """Returns (new_value_or_None, reason). new_value is None => leave as-is."""
    if raw in CANONICAL_COLORS:
        return raw, "already canonical"

    lower = raw.strip().lower()
    if lower in _CANONICAL_LOWER:
        return _CANONICAL_LOWER[lower], "re-cased to canonical spelling"

    if lower in _SYNONYMS:
        return _SYNONYMS[lower], f"mapped known synonym {raw!r}"

    return None, "NEEDS_REVIEW: no canonical match or known synonym"


def run(dry_run: bool = False) -> None:
    changed = 0
    unchanged = 0
    flagged = 0

    with SessionLocal() as db:
        products = db.scalars(select(Product)).all()

        for product in products:
            variants = product.variants or []
            if not any(v.get("color") for v in variants):
                continue

            dirty = False
            for variant in variants:
                color = variant.get("color")
                if not color:
                    continue
                new_value, reason = normalize_one(color)
                if new_value is None:
                    print(f"  {'[DRY] ' if dry_run else ''}FLAG  {product.name!r} ({product.slug}) color={color!r}: {reason}")
                    flagged += 1
                    continue
                if new_value == color:
                    unchanged += 1
                    continue
                print(f"  {'[DRY] ' if dry_run else ''}SET   {product.name!r} ({product.slug}) {color!r} -> {new_value!r} [{reason}]")
                variant["color"] = new_value
                dirty = True
                changed += 1

            if dirty and not dry_run:
                # Same JSON-column mutation caveat as normalize_variant_sizes.py:
                # in-place dict mutation needs flag_modified to be detected.
                flag_modified(product, "variants")
                db.add(product)

        if not dry_run:
            db.commit()

    verb = "Would change" if dry_run else "Changed"
    print(f"\n{verb} {changed} color value(s); {unchanged} already canonical; {flagged} flagged for manual review.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Normalize free-typed variant colors to canonical values.")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing.")
    args = parser.parse_args()
    run(dry_run=args.dry_run)

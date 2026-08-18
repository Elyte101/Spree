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

Idempotent: every reachable output value (CANONICAL_COLORS entries, and
every _SYNONYMS value) is itself in CANONICAL_COLORS, so a second pass
always hits branch 1 ("already canonical") for anything this script wrote.

Run from the backend directory:
    python scripts/normalize_variant_colors.py             # dry-run (default)
    python scripts/normalize_variant_colors.py --apply      # actually write
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend/ — for app.*
sys.path.insert(0, str(Path(__file__).resolve().parent))  # scripts/ — for _migration_lib

from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from _migration_lib import build_arg_parser, print_table, resolve_dry_run
from app.core.color_taxonomy import COLOR_OPTIONS as CANONICAL_COLORS
from app.db.models import Product
from app.db.session import SessionLocal

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


def run(dry_run: bool = True) -> list[tuple[str, str, str, str]]:
    """Returns the list of (product, slug, before, after) rows changed/found."""
    rows: list[tuple[str, str, str, str]] = []
    flagged: list[tuple[str, str, str]] = []
    unchanged = 0

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
                    flagged.append((product.name[:40], product.slug[:30], color))
                    continue
                if new_value == color:
                    unchanged += 1
                    continue
                rows.append((product.name[:40], product.slug[:30], color, new_value))
                if not dry_run:
                    variant["color"] = new_value
                    dirty = True

            if dirty and not dry_run:
                # In-place dict mutation inside a JSON column isn't enough
                # for SQLAlchemy to detect a change — flag_modified forces it
                # into the UPDATE regardless.
                flag_modified(product, "variants")
                db.add(product)

        if not dry_run:
            db.commit()

    print_table(["product", "slug", "before", "after"], rows)
    if flagged:
        print("\nFlagged for manual review (left unchanged):")
        print_table(["product", "slug", "color"], flagged)

    verb = "Would change" if dry_run else "Changed"
    print(f"\n{verb} {len(rows)} color value(s); {unchanged} already canonical; {len(flagged)} flagged for manual review.")
    return rows


if __name__ == "__main__":
    parser = build_arg_parser("Normalize free-typed variant colors to canonical values.")
    args = parser.parse_args()
    run(dry_run=resolve_dry_run(args))

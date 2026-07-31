"""
One-off cleanup: normalize free-typed `size` values inside Product.variants
(the JSON column create_product/update_product build the color x size grid
into — see backend/app/services/catalog.py) to the canonical values sellers
now pick from (backend/app/core/size_taxonomy.py / lib/productTaxonomy.ts).

Per-value decision, in order:
  1. Already an exact match for the product's main category's preset list
     (or the generic fallback) -> unchanged, logged as "already canonical".
  2. Parses cleanly as "<number><unit>" with no extra words (e.g. "20cm")
     -> reformatted to "<number> <unit>" (e.g. "20 cm"), keeping the real
     value — this does NOT force it onto one of the curated presets, since a
     real-world measurement need not be exactly a suggested dropdown option.
     Still flagged NEEDS_REVIEW instead if the unit matches a preset group
     that has its own bounded range (e.g. screen size) and the number falls
     outside it (e.g. a "phone" that's supposedly 18" or 30" — implausible,
     likely bad source data, not something to silently reformat and trust).
  3. Parses as "<number><unit> <trailing words>" (e.g. "6.15\" height") ->
     snapped to the nearest preset in whichever group shares that unit
     (e.g. nearest Screen size preset), IF the nearest one is within a sane
     relative distance. Otherwise NEEDS_REVIEW.
  4. Anything else (no number+unit parse at all) -> NEEDS_REVIEW.

NEEDS_REVIEW values are never written — only logged, for a human to look at.

Run from the backend directory:
    python scripts/normalize_variant_sizes.py [--dry-run]
"""

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from app.core.size_taxonomy import SIZE_OPTIONS_BY_MAIN_CATEGORY_SLUG, GENERIC_SIZES
from app.db.models import Category, Product
from app.db.session import SessionLocal

# unit -> normalized display form appended directly after the number
# ("" means no space before it, e.g. 6.1" not 6.1 ").
_UNIT_NORMALIZATION: list[tuple[str, str, bool]] = [
    # (regex-unit-alternation, canonical-unit, no_space_before_unit)
    (r'"|in(?:ch(?:es)?)?', '"', True),
    (r"cm", "cm", False),
    (r"mm", "mm", False),
    (r"ft|feet|foot", "ft", False),
    (r"yards?", "yard", False),  # pluralization fixed up separately
    (r"m(?!m)", "m", False),
    (r"ml", "ml", False),
    (r"l", "L", False),
    (r"kg", "kg", False),
    (r"g(?!b)", "g", False),
    (r"gb", "GB", False),
    (r"tb", "TB", False),
]

_NUMBER_UNIT_RE = re.compile(
    r"^\s*(\d+(?:\.\d+)?)\s*(" + "|".join(u for u, _, _ in _UNIT_NORMALIZATION) + r")\s*(.*)$",
    re.IGNORECASE,
)


def _main_category_slug(category: Category | None) -> str | None:
    if category is None:
        return None
    return category.slug if category.parent_id is None else (category.parent.slug if category.parent else None)


def _allowed_sizes(slug: str | None) -> list[str]:
    if slug and slug in SIZE_OPTIONS_BY_MAIN_CATEGORY_SLUG:
        return SIZE_OPTIONS_BY_MAIN_CATEGORY_SLUG[slug]
    return GENERIC_SIZES


def _canonical_unit(raw_unit: str) -> tuple[str, bool] | None:
    for pattern, canonical, no_space in _UNIT_NORMALIZATION:
        if re.fullmatch(pattern, raw_unit, re.IGNORECASE):
            return canonical, no_space
    return None


def _format(number: str, unit: str, no_space: bool) -> str:
    # Pluralize yard/foot the way the presets do (2 yards, 3 ft stays ft).
    n = float(number)
    display_number = str(int(n)) if n == int(n) else number
    if unit == "yard" and n != 1:
        unit = "yards"
    sep = "" if no_space else " "
    return f"{display_number}{sep}{unit}"


def _same_unit_group(allowed: list[str], unit: str, no_space: bool) -> list[tuple[float, str]]:
    """Every allowed preset whose own unit matches, as (numeric value, raw)."""
    group: list[tuple[float, str]] = []
    for value in allowed:
        m = _NUMBER_UNIT_RE.match(value)
        if not m:
            continue
        preset_unit_info = _canonical_unit(m.group(2))
        if preset_unit_info and preset_unit_info == (unit, no_space):
            group.append((float(m.group(1)), value))
    return group


def normalize_one(raw: str, allowed: list[str]) -> tuple[str | None, str]:
    """Returns (new_value_or_None, reason). new_value is None => leave as-is."""
    if raw in allowed:
        return raw, "already canonical"

    match = _NUMBER_UNIT_RE.match(raw)
    if not match:
        return None, "NEEDS_REVIEW: no recognizable <number><unit> pattern"

    number, raw_unit, trailing = match.groups()
    unit_info = _canonical_unit(raw_unit)
    if unit_info is None:
        return None, f"NEEDS_REVIEW: unrecognized unit {raw_unit!r}"
    unit, no_space = unit_info
    trailing = trailing.strip()
    reformatted = _format(number, unit, no_space)
    same_unit_presets = _same_unit_group(allowed, unit, no_space)

    if not trailing:
        # Clean bare "<number><unit>" — keep the real value, just reformat.
        # Still sanity-check against a same-unit preset group's own range,
        # if this category has one (e.g. Screen size for phones) — a value
        # wildly outside it is more likely bad source data than a real size.
        if same_unit_presets:
            lo = min(v for v, _ in same_unit_presets)
            hi = max(v for v, _ in same_unit_presets)
            n = float(number)
            if n < lo * 0.5 or n > hi * 1.5:
                return None, (
                    f"NEEDS_REVIEW: {n}{unit} is implausible for this category's "
                    f"{unit}-based sizes (expected roughly {lo}-{hi}{unit})"
                )
        return reformatted, "reformatted (kept real value)"

    # Has trailing descriptive text (e.g. "height") — too ambiguous to trust
    # literally; snap to the nearest same-unit preset if there's a close one.
    if not same_unit_presets:
        return None, f"NEEDS_REVIEW: {trailing!r} qualifier and no {unit}-based preset group to snap to"
    n = float(number)
    nearest_value, nearest_raw = min(same_unit_presets, key=lambda pair: abs(pair[0] - n))
    relative_diff = abs(nearest_value - n) / max(nearest_value, n)
    if relative_diff > 0.25:
        return None, (
            f"NEEDS_REVIEW: nearest preset to {n}{unit} ({trailing!r}) is {nearest_raw!r}, "
            f"too far off ({relative_diff:.0%}) to snap automatically"
        )
    return nearest_raw, f"snapped {raw!r} -> nearest preset (had qualifier {trailing!r})"


def run(dry_run: bool = False) -> None:
    changed = 0
    unchanged = 0
    flagged = 0

    with SessionLocal() as db:
        products = db.scalars(
            select(Product).options(selectinload(Product.category).selectinload(Category.parent))
        ).all()

        for product in products:
            variants = product.variants or []
            if not any(v.get("size") for v in variants):
                continue

            slug = _main_category_slug(product.category)
            allowed = _allowed_sizes(slug)
            dirty = False

            for variant in variants:
                size = variant.get("size")
                if not size:
                    continue
                new_value, reason = normalize_one(size, allowed)
                if new_value is None:
                    print(f"  {'[DRY] ' if dry_run else ''}FLAG  {product.name!r} ({product.slug}) size={size!r}: {reason}")
                    flagged += 1
                    continue
                if new_value == size:
                    # A judgment call (reformat/snap) can still land back on
                    # the original string (e.g. '18"' needs no reformatting)
                    # — log it as reviewed, distinct from a value that was
                    # already an exact preset match and needed no judgment.
                    if reason != "already canonical":
                        print(f"  {'[DRY] ' if dry_run else ''}KEEP  {product.name!r} ({product.slug}) size={size!r} unchanged [{reason}]")
                    unchanged += 1
                    continue
                print(f"  {'[DRY] ' if dry_run else ''}SET   {product.name!r} ({product.slug}) {size!r} -> {new_value!r} [{reason}]")
                variant["size"] = new_value
                dirty = True
                changed += 1

            if dirty and not dry_run:
                # In-place dict mutation inside a JSON column isn't enough
                # for SQLAlchemy to detect a change (the "before" snapshot
                # already points at the same, now-mutated dicts — reassigning
                # product.variants to a new outer list doesn't help either,
                # since it still wraps those same inner dicts) — flag_modified
                # forces it into the UPDATE regardless. Verified: without
                # this, db.commit() silently no-ops on this column.
                flag_modified(product, "variants")
                db.add(product)

        if not dry_run:
            db.commit()

    verb = "Would change" if dry_run else "Changed"
    print(f"\n{verb} {changed} size value(s); {unchanged} already canonical; {flagged} flagged for manual review.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Normalize free-typed variant sizes to canonical values.")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing.")
    args = parser.parse_args()
    run(dry_run=args.dry_run)

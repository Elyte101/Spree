"""Mirrors the size option sets in lib/productTaxonomy.ts (the seller
create/edit product forms' Sizes multi-select). Keep both in sync manually —
the TypeScript/Python split means there's no single shared source.

Used only for server-side validation: the frontend already restricts the
picker to these values, so this is the defense-in-depth backstop against a
direct API call submitting a size outside the allowed set for a product's
category.
"""

CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]

KIDS_AGE_SIZES = ["0-3m", "3-6m", "6-12m", "1-2y", "2-4y", "4-6y", "6-8y", "8-12y"]

# EU/UK/US conversion is the standard commercial (men's-numbering) table.
_SHOE_SIZE_TABLE = [
    ("36", "3.5", "4.5"), ("37", "4", "5"), ("38", "5", "6"), ("39", "5.5", "6.5"),
    ("40", "6.5", "7.5"), ("41", "7", "8"), ("42", "8", "9"), ("43", "9", "10"),
    ("44", "9.5", "10.5"), ("45", "10.5", "11.5"), ("46", "11", "12"), ("47", "12", "13"),
]
SHOE_SIZES = [f"EU {eu} / UK {uk} / US {us}" for eu, uk, us in _SHOE_SIZE_TABLE]

FABRIC_YARDS = ["1 yard", "2 yards", "4 yards", "6 yards", "12 yards"]
FABRIC_METERS = ["1 m", "2 m", "5 m", "10 m"]

SCREEN_SIZES = ['5.5"', '6.1"', '6.7"', '13"', '14"', '16"']
STORAGE_SIZES = ["64GB", "128GB", "256GB", "512GB", "1TB", "2TB"]

VOLUME_SIZES = ["30 ml", "50 ml", "100 ml", "250 ml", "500 ml", "1 L"]
WEIGHT_SIZES = ["100 g", "250 g", "500 g", "1 kg"]

DIMENSION_SIZES = ["30 cm", "50 cm", "1 m", "2 m", "6 in", "12 in", "18 in", "1 ft", "3 ft", "6 ft"]

GENERIC_SIZES = ["One size", "Small", "Medium", "Large"]

# Keyed by main-category slug (see backend/app/db/init_db.py's
# _CATEGORY_TAXONOMY). A slug with no entry here falls back to GENERIC_SIZES.
SIZE_OPTIONS_BY_MAIN_CATEGORY_SLUG: dict[str, list[str]] = {
    "fashion-apparel": CLOTHING_SIZES,
    "baby-kids": CLOTHING_SIZES + KIDS_AGE_SIZES,
    "shoes-footwear": SHOE_SIZES,
    "fabrics-textiles": FABRIC_YARDS + FABRIC_METERS,
    "phones-accessories": SCREEN_SIZES + STORAGE_SIZES,
    "electronics-gadgets": SCREEN_SIZES + STORAGE_SIZES,
    "tech": SCREEN_SIZES + STORAGE_SIZES,
    "beauty-personal-care": VOLUME_SIZES + WEIGHT_SIZES,
    "food-groceries": VOLUME_SIZES + WEIGHT_SIZES,
    "home-living": DIMENSION_SIZES,
    "kitchen-dining": DIMENSION_SIZES,
    "tools-hardware": DIMENSION_SIZES,
}


def allowed_sizes_for_slug(slug: str | None) -> list[str]:
    if slug and slug in SIZE_OPTIONS_BY_MAIN_CATEGORY_SLUG:
        return SIZE_OPTIONS_BY_MAIN_CATEGORY_SLUG[slug]
    return GENERIC_SIZES

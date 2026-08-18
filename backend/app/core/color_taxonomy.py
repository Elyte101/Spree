"""Mirrors lib/productTaxonomy.ts's COLOR_OPTIONS (the seller create/edit
product forms' Colors multi-select). Keep both in sync manually — the
TypeScript/Python split means there's no single shared source (same caveat
as size_taxonomy.py).

Used only for server-side validation: the frontend already restricts the
picker to these values, so this is the defense-in-depth backstop against a
direct API call submitting a color outside the canonical set.
"""

COLOR_OPTIONS = [
    "Black", "White", "Gray", "Silver", "Gold",
    "Red", "Maroon", "Pink", "Orange", "Yellow",
    "Green", "Olive", "Teal", "Turquoise", "Blue", "Navy",
    "Purple", "Lavender", "Brown", "Beige", "Cream", "Sand",
    "Multicolor", "Ankara Print", "Kente Print",
]

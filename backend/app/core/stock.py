"""Single source of truth for product.stock vs. variant stock.

Variant stock is authoritative wherever variants exist — product.stock is a
derived total kept in sync by every write path (create, edit, order
placement/decrement) via derive_stock(). A product with no variants has
nothing to derive from, so its stock is just the plain fallback value.
"""


def derive_stock(variants: list[dict], fallback: int) -> int:
    if not variants:
        return max(int(fallback), 0)
    return sum(max(int(v.get("stock", 0)), 0) for v in variants)


def redistribute_stock(variants: list[dict], total: int) -> list[dict]:
    """Evenly spread `total` units across existing variants, preserving each
    variant's identity (id/sku/color/size/label/image) — same distribution
    rule _build_variants (catalog.py) uses when it has no explicit
    per-variant stock to work from. Used when a caller sets a flat stock
    total (e.g. the dashboard's quick "edit stock" action) on a product that
    already has a variant grid, where there's no way to know which specific
    variant the new total applies to.
    """
    if not variants:
        return variants
    count = len(variants)
    total = max(int(total), 0)
    per_variant, remainder = divmod(total, count)
    return [
        {**variant, "stock": per_variant + (1 if index <= remainder else 0)}
        for index, variant in enumerate(variants, start=1)
    ]

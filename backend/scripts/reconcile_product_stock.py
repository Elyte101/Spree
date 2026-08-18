"""
One-off + re-runnable reconciliation: product.stock vs sum(variant.stock).

Variant stock is authoritative (app/core/stock.py) — every write path
(create/edit/order-decrement) now keeps them in sync going forward, but
existing rows written before that fix can still disagree. This script finds
every disagreement, prints a before/after table, and (with --apply) sets
product.stock = sum(variant.stock) to match.

Products with no variants are skipped — there's nothing to reconcile against.

Idempotent: a second run (dry or applied) against already-fixed data finds
zero drift, by construction — this only ever changes product.stock, and the
condition it checks (product.stock != sum(variant.stock)) is false immediately
after a fix is applied.

Run from the backend directory:
    python scripts/reconcile_product_stock.py             # dry-run (default)
    python scripts/reconcile_product_stock.py --apply      # actually write
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend/ — for app.*
sys.path.insert(0, str(Path(__file__).resolve().parent))  # scripts/ — for _migration_lib

from sqlalchemy import select

from _migration_lib import build_arg_parser, print_table, resolve_dry_run, summarize
from app.core.stock import derive_stock
from app.db.models import Product
from app.db.session import SessionLocal


def run(dry_run: bool = True) -> list[tuple[str, str, int, int]]:
    """Returns the list of (name, slug, before, after) rows changed/found."""
    with SessionLocal() as db:
        products = db.scalars(select(Product)).all()

        drifted: list[tuple[Product, int]] = []
        for product in products:
            variants = product.variants or []
            if not variants:
                continue
            correct = derive_stock(variants, product.stock)
            if correct != product.stock:
                drifted.append((product, correct))

        rows = [(p.name[:40], p.slug[:30], p.stock, correct) for p, correct in drifted]
        print_table(["product", "slug", "before", "after"], rows)

        if not dry_run:
            for product, correct in drifted:
                product.stock = correct
                db.add(product)
            db.commit()

    summarize("Would fix", "Fixed", dry_run, len(drifted), "product(s) with drifted stock")
    return rows


if __name__ == "__main__":
    parser = build_arg_parser("Reconcile product.stock with sum(variant.stock).")
    args = parser.parse_args()
    run(dry_run=resolve_dry_run(args))

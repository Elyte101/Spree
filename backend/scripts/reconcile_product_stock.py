"""
One-off + re-runnable reconciliation: product.stock vs sum(variant.stock).

Variant stock is authoritative (app/core/stock.py) — every write path
(create/edit/order-decrement) now keeps them in sync going forward, but
existing rows written before that fix can still disagree. This script finds
every disagreement, prints a before/after table, and (unless --dry-run) sets
product.stock = sum(variant.stock) to match.

Products with no variants are skipped — there's nothing to reconcile against.

Run from the backend directory:
    python scripts/reconcile_product_stock.py [--dry-run]
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.core.stock import derive_stock
from app.db.models import Product
from app.db.session import SessionLocal


def run(dry_run: bool = False) -> None:
    with SessionLocal() as db:
        products = db.scalars(select(Product)).all()

        drifted = []
        for product in products:
            variants = product.variants or []
            if not variants:
                continue
            correct = derive_stock(variants, product.stock)
            if correct != product.stock:
                drifted.append((product, correct))

        if not drifted:
            print("No drift found — product.stock already matches sum(variant.stock) everywhere.")
            return

        header = f"{'product':<40} {'slug':<30} {'before':>8} {'after':>8}"
        print(header)
        print("-" * len(header))
        for product, correct in drifted:
            print(f"{product.name[:40]:<40} {product.slug[:30]:<30} {product.stock:>8} {correct:>8}")
            if not dry_run:
                product.stock = correct
                db.add(product)

        if not dry_run:
            db.commit()

    verb = "Would fix" if dry_run else "Fixed"
    print(f"\n{verb} {len(drifted)} product(s) with drifted stock.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reconcile product.stock with sum(variant.stock).")
    parser.add_argument("--dry-run", action="store_true", help="Print the before/after table without writing.")
    args = parser.parse_args()
    run(dry_run=args.dry_run)

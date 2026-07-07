"""
Backfill estimatedDeliveryDate / estimatedDeliveryDays for orders where
both fields are currently NULL.

Strategy:
  - Use shippedAt as the base if available (parcel was dispatched → tighter ETA).
  - Fall back to paidAt, then createdAt for pre-shipment orders.
  - All statuses are backfilled, including delivered/confirmed, so the tracking
    page can show what the estimate was even for completed orders.
  - Cancelled and refunded orders are skipped — a delivery estimate is meaningless.

Run from the backend directory:
    python scripts/backfill_delivery_dates.py [--dry-run]
"""

import argparse
import sys
from pathlib import Path

# Ensure the backend package is importable when run directly.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from datetime import timezone

from sqlalchemy import select

from app.db.models import Order
from app.db.session import SessionLocal
from app.services.orders import DELIVERY_DAYS, _add_business_days, _delivery_days_for_method

SKIP_STATUSES = {"cancelled", "refunded"}


def backfill(dry_run: bool = False) -> None:
    updated = 0
    skipped = 0

    with SessionLocal() as db:
        orders = db.scalars(
            select(Order).where(
                Order.estimated_delivery_date.is_(None)
            )
        ).all()

        print(f"Found {len(orders)} orders with null estimatedDeliveryDate")

        for order in orders:
            if order.status in SKIP_STATUSES:
                skipped += 1
                continue

            # Choose base timestamp: shipped > paid > created.
            base = order.shipped_at or order.paid_at or order.created_at
            if base is None:
                print(f"  SKIP {order.id}: no timestamp available")
                skipped += 1
                continue

            # Ensure timezone-aware.
            if base.tzinfo is None:
                base = base.replace(tzinfo=timezone.utc)

            bd = _delivery_days_for_method(order.shipping_method or "standard")
            eta = _add_business_days(base, bd)

            print(
                f"  {'[DRY]' if dry_run else 'SET '} {order.id} "
                f"status={order.status} method={order.shipping_method!r} "
                f"base={base.date()} bd={bd} → eta={eta.date()}"
            )

            if not dry_run:
                order.estimated_delivery_days = bd
                order.estimated_delivery_date = eta
            updated += 1

        if not dry_run:
            db.commit()

    verb = "Would update" if dry_run else "Updated"
    print(f"\n{verb} {updated} orders, skipped {skipped}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill delivery date estimates.")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing.")
    args = parser.parse_args()
    backfill(dry_run=args.dry_run)

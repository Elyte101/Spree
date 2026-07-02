"""Pricing engine — commission brackets and processing fees.

G11: Both the processing fee rate and commission brackets can be overridden
at runtime by an admin via SiteSetting rows (see /admin/site-settings).

Settings keys:
  processing_fee_rate   — decimal string, e.g. "0.015"
  commission_brackets   — JSON array of [ceiling_or_null, rate] pairs, e.g.
                          [[500, "0.08"], [2000, "0.05"], [5000, "0.03"], [null, "0.01"]]

If the settings keys are absent, the module falls back to the hardcoded defaults below.
"""

from __future__ import annotations

import json
import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import NamedTuple

logger = logging.getLogger(__name__)

# Hardcoded defaults — overridden by admin via SiteSetting.
_DEFAULT_PROCESSING_FEE_RATE = Decimal("0.015")

# G11: runtime-configurable processing fee rate (updated by load_settings_from_db).
PROCESSING_FEE_RATE = _DEFAULT_PROCESSING_FEE_RATE


def calc_processing_fee(subtotal: Decimal) -> Decimal:
    """Payment processing fee charged to the buyer: 1.5% of subtotal."""
    return (subtotal * PROCESSING_FEE_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

# Marginal commission brackets — each rate applies only to the portion of
# seller_price within its band. This ensures commission and buyer_price are
# strictly monotonically increasing, removing tier-boundary gaming.
_BRACKETS: list[tuple[Decimal | None, Decimal]] = [
    (Decimal("500"),  Decimal("0.08")),
    (Decimal("2000"), Decimal("0.05")),
    (Decimal("5000"), Decimal("0.03")),
    (None,            Decimal("0.01")),
]

# Fallback for orders created before tiered pricing (commission_rate column = NULL).
LEGACY_COMMISSION_RATE = Decimal("0.05")


def load_settings_from_db(db) -> None:  # db: Session — avoid circular import
    """G11: Load admin-configurable pricing settings from SiteSetting rows at startup.

    Called once during app startup in init_db.py after the DB is ready.
    Also call this after an admin updates a pricing setting so the runtime
    values are refreshed without a server restart.
    """
    global PROCESSING_FEE_RATE, _BRACKETS  # noqa: PLW0603

    try:
        from app.db.models import SiteSetting  # noqa: PLC0415

        fee_row = db.get(SiteSetting, "processing_fee_rate")
        if fee_row:
            PROCESSING_FEE_RATE = Decimal(fee_row.value)
            logger.info("[pricing] processing_fee_rate=%s (from DB)", PROCESSING_FEE_RATE)

        brackets_row = db.get(SiteSetting, "commission_brackets")
        if brackets_row:
            raw = json.loads(brackets_row.value)
            _BRACKETS = [
                (Decimal(str(ceiling)) if ceiling is not None else None, Decimal(str(rate)))
                for ceiling, rate in raw
            ]
            logger.info("[pricing] commission_brackets loaded from DB: %s", _BRACKETS)
    except Exception:  # noqa: BLE001
        logger.warning("[pricing] Could not load pricing settings from DB — using defaults")


class CommissionResult(NamedTuple):
    amount: Decimal
    effective_rate: Decimal


def calc_commission(seller_price: Decimal) -> CommissionResult:
    """Marginal-bracket commission. Returns (amount, effective_rate).

    effective_rate = amount / seller_price, stored on OrderItem so payout
    can be recovered as listed_price / (1 + effective_rate).
    """
    if seller_price <= Decimal("0"):
        return CommissionResult(Decimal("0"), Decimal("0"))

    total = Decimal("0")
    prev = Decimal("0")
    for ceiling, rate in _BRACKETS:
        if seller_price <= prev:
            break
        top = seller_price if ceiling is None else min(seller_price, ceiling)
        total += (top - prev) * rate
        if ceiling is None:
            break
        prev = ceiling

    amount = total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    effective_rate = (amount / seller_price).quantize(Decimal("0.00000001"), rounding=ROUND_HALF_UP)
    return CommissionResult(amount, effective_rate)


def commission_rate(seller_price: Decimal) -> Decimal:
    """Effective commission rate — stored per OrderItem for accurate payout reversal."""
    return calc_commission(seller_price).effective_rate


def buyer_price(seller_price: Decimal) -> Decimal:
    commission = calc_commission(seller_price).amount
    return (seller_price + commission).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def seller_payout_from_listed(listed_price: Decimal, rate: Decimal | None) -> Decimal:
    effective = rate if rate is not None else LEGACY_COMMISSION_RATE
    return (listed_price / (Decimal("1") + effective)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

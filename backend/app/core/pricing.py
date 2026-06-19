from decimal import Decimal, ROUND_HALF_UP
from typing import NamedTuple

PROCESSING_FEE_RATE = Decimal("0.015")


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

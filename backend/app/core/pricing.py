from decimal import Decimal, ROUND_HALF_UP

# Price tiers: (max_seller_price_inclusive, commission_rate)
# Evaluated top-to-bottom; last entry is the floor (no upper bound).
_TIERS: list[tuple[Decimal | None, Decimal]] = [
    (Decimal("500"),  Decimal("0.08")),
    (Decimal("2000"), Decimal("0.05")),
    (Decimal("5000"), Decimal("0.03")),
    (None,            Decimal("0.01")),
]

# Fallback for orders created before tiered pricing (column = NULL).
LEGACY_COMMISSION_RATE = Decimal("0.05")


def commission_rate(seller_price: Decimal) -> Decimal:
    for ceiling, rate in _TIERS:
        if ceiling is None or seller_price <= ceiling:
            return rate
    return _TIERS[-1][1]


def buyer_price(seller_price: Decimal) -> Decimal:
    rate = commission_rate(seller_price)
    return (seller_price * (Decimal("1") + rate)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def seller_payout_from_listed(listed_price: Decimal, rate: Decimal | None) -> Decimal:
    effective = rate if rate is not None else LEGACY_COMMISSION_RATE
    return (listed_price / (Decimal("1") + effective)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

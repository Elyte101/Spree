"""Tests for marginal-bracket commission logic in app.core.pricing."""
import pytest
from decimal import Decimal
from app.core.pricing import calc_commission, buyer_price, seller_payout_from_listed


def test_zero_payout():
    r = calc_commission(Decimal("0"))
    assert r.amount == Decimal("0")
    assert r.effective_rate == Decimal("0")


def test_full_first_bracket():
    r = calc_commission(Decimal("500"))
    assert r.amount == Decimal("40.00")


@pytest.mark.parametrize("payout,expected", [
    ("1000",  "65.00"),   # 500*8% + 500*5%
    ("2000",  "115.00"),  # 500*8% + 1500*5%
    ("3000",  "145.00"),  # +1000*3%
    ("5000",  "205.00"),  # +3000*3% total
    ("6000",  "215.00"),  # 40+75+90+10 = 215
])
def test_marginal_brackets(payout, expected):
    assert calc_commission(Decimal(payout)).amount == Decimal(expected)


def test_buyer_price_equals_payout_plus_commission():
    for payout in [100, 500, 501, 1000, 2000, 2001, 5000, 5001, 8000]:
        sp = Decimal(str(payout))
        expected = sp + calc_commission(sp).amount
        assert buyer_price(sp) == expected.quantize(Decimal("0.01"))


def test_old_exploit_fixed_2000_vs_2038():
    """With flat tiers, payout=2038 used to yield lower customerPays than payout=2000."""
    bp_2000 = buyer_price(Decimal("2000"))
    bp_2038 = buyer_price(Decimal("2038"))
    assert bp_2038 > bp_2000
    assert calc_commission(Decimal("2038")).amount > calc_commission(Decimal("2000")).amount


def test_exploit_fixed_at_500_boundary():
    assert buyer_price(Decimal("501")) > buyer_price(Decimal("500"))


def test_exploit_fixed_at_5000_boundary():
    assert buyer_price(Decimal("5001")) > buyer_price(Decimal("5000"))


def test_monotonicity_1_to_6000():
    """commission and buyer_price must be strictly non-decreasing for all integer payouts."""
    prev_commission = Decimal("-1")
    prev_buyer = Decimal("-1")
    for payout in range(1, 6001):
        sp = Decimal(str(payout))
        r = calc_commission(sp)
        bp = buyer_price(sp)
        assert r.amount >= prev_commission, f"commission not non-decreasing at {payout}"
        assert bp > prev_buyer, f"buyer_price not strictly increasing at {payout}"
        prev_commission = r.amount
        prev_buyer = bp


def test_seller_payout_roundtrip():
    """Storing effective_rate and reversing should recover seller_price within 1 cent."""
    for payout in [100, 500, 501, 1000, 2000, 2001, 5000, 5001, 8000]:
        sp = Decimal(str(payout))
        r = calc_commission(sp)
        bp = buyer_price(sp)
        recovered = seller_payout_from_listed(bp, r.effective_rate)
        assert abs(recovered - sp) <= Decimal("0.01"), (
            f"payout {payout}: listed={bp}, rate={r.effective_rate}, recovered={recovered}"
        )

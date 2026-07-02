"""Financial ledger service.

All money movements on the platform are recorded here as immutable LedgerEntry
rows before (or immediately after) the actual Paystack transaction is committed.

Design decisions
----------------
- Amounts are stored in **pesewas** (integer GHS × 100) to avoid Decimal
  rounding issues in Python and SQL.
- Every write is idempotency-keyed so double-charging is impossible even if a
  request retries after a timeout.
- The ledger is append-only — rows are NEVER updated or deleted.

Entry types
-----------
PAYMENT_RECEIVED     — buyer paid; full order total captured from Paystack.
COMMISSION_HELD      — platform commission portion set aside.
PROCESSING_FEE_HELD  — Paystack processing-fee portion set aside.
SELLER_CREDIT        — net payout amount earmarked for the seller.
PAYOUT_INITIATED     — Paystack transfer to seller started.
PAYOUT_CONFIRMED     — Paystack transfer completed (webhook confirmation).
PAYOUT_FAILED        — Paystack transfer failed; funds re-queued.
REFUND_INITIATED     — buyer refund started.
REFUND_CONFIRMED     — buyer refund settled.
AUTO_RELEASE         — escrow released automatically after timeout.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.orm import Session

from app.db.models import LedgerEntry

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Entry type constants
# ---------------------------------------------------------------------------

PAYMENT_RECEIVED = "PAYMENT_RECEIVED"
COMMISSION_HELD = "COMMISSION_HELD"
PROCESSING_FEE_HELD = "PROCESSING_FEE_HELD"
SELLER_CREDIT = "SELLER_CREDIT"
PAYOUT_INITIATED = "PAYOUT_INITIATED"
PAYOUT_CONFIRMED = "PAYOUT_CONFIRMED"
PAYOUT_FAILED = "PAYOUT_FAILED"
REFUND_INITIATED = "REFUND_INITIATED"
REFUND_CONFIRMED = "REFUND_CONFIRMED"
AUTO_RELEASE = "AUTO_RELEASE"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ghs_to_pesewas(amount: Decimal | int | float) -> int:
    """Convert GHS (2 decimal places) to pesewas (integer)."""
    return int(Decimal(str(amount)) * 100)


def _new_id() -> str:
    return f"led-{uuid4().hex[:18]}"


# ---------------------------------------------------------------------------
# Write operations
# ---------------------------------------------------------------------------

def record_payment_received(
    db: Session,
    *,
    order_id: str,
    user_id: str | None,
    amount_ghs: Decimal,
    reference: str,
    idempotency_key: str,
    meta: dict | None = None,
) -> LedgerEntry:
    """Record that a buyer's payment was successfully captured by Paystack."""
    return _append(
        db,
        entry_type=PAYMENT_RECEIVED,
        order_id=order_id,
        user_id=user_id,
        amount_pesewas=_ghs_to_pesewas(amount_ghs),
        reference=reference,
        idempotency_key=idempotency_key,
        meta=meta,
    )


def record_commission_held(
    db: Session,
    *,
    order_id: str,
    seller_id: str | None,
    commission_ghs: Decimal,
    commission_rate: Decimal,
    idempotency_key: str,
) -> LedgerEntry:
    """Record the platform commission portion being withheld from the seller."""
    return _append(
        db,
        entry_type=COMMISSION_HELD,
        order_id=order_id,
        seller_id=seller_id,
        amount_pesewas=_ghs_to_pesewas(commission_ghs),
        idempotency_key=idempotency_key,
        meta={"commission_rate": str(commission_rate)},
    )


def record_processing_fee_held(
    db: Session,
    *,
    order_id: str,
    fee_ghs: Decimal,
    fee_rate: Decimal,
    idempotency_key: str,
) -> LedgerEntry:
    """Record the Paystack processing fee being withheld."""
    return _append(
        db,
        entry_type=PROCESSING_FEE_HELD,
        order_id=order_id,
        amount_pesewas=_ghs_to_pesewas(fee_ghs),
        idempotency_key=idempotency_key,
        meta={"processing_fee_rate": str(fee_rate)},
    )


def record_seller_credit(
    db: Session,
    *,
    order_id: str,
    seller_id: str,
    net_payout_ghs: Decimal,
    idempotency_key: str,
    meta: dict | None = None,
) -> LedgerEntry:
    """Record the net amount earmarked for the seller (after fees/commission)."""
    return _append(
        db,
        entry_type=SELLER_CREDIT,
        order_id=order_id,
        seller_id=seller_id,
        amount_pesewas=_ghs_to_pesewas(net_payout_ghs),
        idempotency_key=idempotency_key,
        meta=meta,
    )


def record_payout_initiated(
    db: Session,
    *,
    order_id: str,
    seller_id: str,
    amount_ghs: Decimal,
    reference: str,
    idempotency_key: str,
) -> LedgerEntry:
    """Record that a Paystack transfer to the seller has been initiated."""
    return _append(
        db,
        entry_type=PAYOUT_INITIATED,
        order_id=order_id,
        seller_id=seller_id,
        amount_pesewas=_ghs_to_pesewas(amount_ghs),
        reference=reference,
        idempotency_key=idempotency_key,
    )


def record_payout_confirmed(
    db: Session,
    *,
    order_id: str,
    seller_id: str | None,
    amount_ghs: Decimal,
    reference: str,
    idempotency_key: str,
) -> LedgerEntry:
    """Record that a Paystack transfer to the seller has been confirmed."""
    return _append(
        db,
        entry_type=PAYOUT_CONFIRMED,
        order_id=order_id,
        seller_id=seller_id,
        amount_pesewas=_ghs_to_pesewas(amount_ghs),
        reference=reference,
        idempotency_key=idempotency_key,
    )


def record_payout_failed(
    db: Session,
    *,
    order_id: str,
    seller_id: str | None,
    amount_ghs: Decimal,
    reference: str,
    idempotency_key: str,
    reason: str = "",
) -> LedgerEntry:
    """Record that a payout transfer failed (Paystack webhook or error)."""
    return _append(
        db,
        entry_type=PAYOUT_FAILED,
        order_id=order_id,
        seller_id=seller_id,
        amount_pesewas=_ghs_to_pesewas(amount_ghs),
        reference=reference,
        idempotency_key=idempotency_key,
        meta={"reason": reason},
    )


def record_refund_initiated(
    db: Session,
    *,
    order_id: str,
    user_id: str | None,
    amount_ghs: Decimal,
    reference: str,
    idempotency_key: str,
) -> LedgerEntry:
    return _append(
        db,
        entry_type=REFUND_INITIATED,
        order_id=order_id,
        user_id=user_id,
        amount_pesewas=_ghs_to_pesewas(amount_ghs),
        reference=reference,
        idempotency_key=idempotency_key,
    )


def record_auto_release(
    db: Session,
    *,
    order_id: str,
    seller_id: str | None,
    amount_ghs: Decimal,
    reference: str,
    idempotency_key: str,
) -> LedgerEntry:
    """Record an automatic escrow release triggered by the cron job (G10)."""
    return _append(
        db,
        entry_type=AUTO_RELEASE,
        order_id=order_id,
        seller_id=seller_id,
        amount_pesewas=_ghs_to_pesewas(amount_ghs),
        reference=reference,
        idempotency_key=idempotency_key,
        meta={"triggered_by": "auto_release_cron"},
    )


# ---------------------------------------------------------------------------
# Read operations
# ---------------------------------------------------------------------------

def get_order_ledger(db: Session, order_id: str) -> list[dict]:
    """Return all ledger entries for an order in chronological order."""
    rows = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.order_id == order_id)
        .order_by(LedgerEntry.created_at)
        .all()
    )
    return [_entry_to_dict(row) for row in rows]


def get_seller_ledger(db: Session, seller_id: str, *, limit: int = 100) -> list[dict]:
    """Return recent ledger entries for a seller."""
    rows = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.seller_id == seller_id)
        .order_by(LedgerEntry.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_entry_to_dict(row) for row in rows]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _append(
    db: Session,
    *,
    entry_type: str,
    amount_pesewas: int,
    order_id: str | None = None,
    seller_id: str | None = None,
    user_id: str | None = None,
    reference: str | None = None,
    idempotency_key: str | None = None,
    meta: dict | None = None,
    currency: str = "GHS",
) -> LedgerEntry:
    """Append a new ledger row.  Never mutates existing rows."""
    if idempotency_key:
        existing = (
            db.query(LedgerEntry)
            .filter(LedgerEntry.idempotency_key == idempotency_key)
            .first()
        )
        if existing is not None:
            logger.info(
                "[ledger] duplicate idempotency_key=%s — returning existing row %s",
                idempotency_key,
                existing.id,
            )
            return existing

    entry = LedgerEntry(
        id=_new_id(),
        entry_type=entry_type,
        order_id=order_id,
        seller_id=seller_id,
        user_id=user_id,
        amount_pesewas=amount_pesewas,
        currency=currency,
        reference=reference,
        idempotency_key=idempotency_key or _new_id(),
        meta=meta,
    )
    db.add(entry)
    logger.info(
        "[ledger] %s order=%s seller=%s amount=%d %s ref=%s",
        entry_type,
        order_id,
        seller_id,
        amount_pesewas,
        currency,
        reference,
    )
    return entry


def _entry_to_dict(entry: LedgerEntry) -> dict:
    return {
        "id": entry.id,
        "entryType": entry.entry_type,
        "orderId": entry.order_id,
        "sellerId": entry.seller_id,
        "userId": entry.user_id,
        "amountPesewas": entry.amount_pesewas,
        "amountGhs": entry.amount_pesewas / 100,
        "currency": entry.currency,
        "reference": entry.reference,
        "meta": entry.meta or {},
        "createdAt": entry.created_at,
    }

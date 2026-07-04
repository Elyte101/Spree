# Payment Bug Fix Log

Rules: Decimal only for money math; atomic DB ops; idempotent webhooks; fix one at a time.

---

## Bug #1 — Double refund on admin retry
**Severity:** Money loss  
**File:** `app/services/orders.py:1258`  
**Symptom:** If Paystack refund call succeeds but returns a network timeout (HTTP 502 to admin), the order status stays "paid". Admin retries → Paystack called again → buyer gets two refunds for one payment.  
**Root cause:** `order.status = "refunded"` and `db.commit()` happen AFTER the Paystack call, so a failed-after-success scenario leaves the status guard bypassable on retry.  
**Fix:** Commit `status="refunded"` BEFORE calling Paystack. If Paystack then fails, order shows "refunded" in DB and admin must complete manually via Paystack dashboard — but at least a retry cannot double-refund.  
**Status:** ✅ Fixed — `orders.py` (commit before Paystack call)  
**Test:** `test_refund_idempotency` in `tests/test_api.py`

---

## Bug #2 — auto_release concurrent double-payout
**Severity:** Money loss (mitigated by Paystack idempotency key, but DB state corrupted)  
**File:** `app/services/orders.py:1082`  
**Symptom:** Two simultaneous cron invocations both fetch the same "delivered" orders without a row lock. Both set `status="confirmed"`, compute payouts, and call `initiate_transfer`. Paystack deduplicates via the idempotency key, but `payout_amount` and `purchase_count` are written twice.  
**Root cause:** `select(Order).where(...)` without `with_for_update(skip_locked=True)` allows concurrent reads.  
**Fix:** Inside the per-order loop, re-fetch each order individually with `with_for_update(skip_locked=True)` and re-check `status == "delivered"` before processing.  
**Status:** ✅ Fixed — `orders.py` (per-order locking in auto_release loop)  
**Test:** `test_auto_release_concurrent` in `tests/test_api.py`

---

## Bug #3 — Wrong Paystack transfer recipient type for GHS
**Severity:** Payout failure (GHS bank transfers silently create wrong recipient type)  
**File:** `app/services/paystack.py:97`  
**Symptom:** `create_transfer_recipient` checks `currency == "$"` to select "ghipss" (Ghanaian Interbank). Since the platform uses "GHS" not "$", this condition is always False → "nuban" (Nigerian bank account type) is used → Paystack rejects GHS bank transfers.  
**Root cause:** Copy-paste error using "$" instead of "GHS" in the currency guard.  
**Fix:** Change to `currency == "GHS"`.  
**Status:** ✅ Fixed — `paystack.py:97`  
**Test:** `test_transfer_recipient_type_ghs` in `tests/test_api.py`

---

## Bug #4 — float(order.total) in _mark_order_paid notification
**Severity:** Float used for currency (violates G12)  
**File:** `app/services/orders.py:386`  
**Symptom:** `float(order.total)` — Decimal column cast to float for notification body. Imprecise for large amounts.  
**Fix:** Use Decimal format directly: `f"{order.total:.2f}"`  
**Status:** ✅ Fixed

---

## Bug #5 — float(order.total) in create_order notification
**Severity:** Float used for currency (violates G12)  
**File:** `app/services/orders.py:747`  
**Fix:** `f"{order.total:.2f}"`  
**Status:** ✅ Fixed

---

## Bug #6 — float(order.total) in refund_order notification
**Severity:** Float used for currency (violates G12)  
**File:** `app/services/orders.py:1275`  
**Fix:** `f"{order.total:.2f}"`  
**Status:** ✅ Fixed

---

## Bug #7 — Float division for transfer amount in transfer.failed webhook
**Severity:** Float used for currency (violates G12)  
**File:** `app/services/orders.py:643`  
**Symptom:** `amount = amount_minor / 100` — Python float division. Used in notification body and logging.  
**Fix:** `amount = Decimal(str(amount_minor)) / 100`  
**Status:** ✅ Fixed

---

## Bug #8 — Float division in ledger _entry_to_dict
**Severity:** Float used for currency (violates G12)  
**File:** `app/services/ledger.py:356`  
**Symptom:** `"amountGhs": entry.amount_pesewas / 100` — Python float. At the serialization boundary but violates the no-float rule.  
**Fix:** `Decimal(entry.amount_pesewas) / 100` — Decimal stays precise; FastAPI's jsonable_encoder handles Decimal → JSON number.  
**Status:** ✅ Fixed

---

## Deferred Issues

### D1 — Ledger never populated
**Severity:** Missing audit trail (not money loss)  
**Reason deferred:** Requires threading `ledger.record_*()` calls into every payment, payout, and refund path in `orders.py`. Large surface area; risk of introducing regressions. Needs its own focused sprint with comprehensive tests.

### D2 — Two-commit pattern in confirm_delivery / auto_release
**Severity:** Vendor not paid if server crashes between commits  
**File:** `orders.py:991, 1128`  
**Reason deferred:** Proper fix requires either (a) rearchitecting to a single-transaction commit or (b) introducing a "payout_pending" state with a retry cron. Both require careful state-machine redesign.

### D3 — transfer.success webhook not processed
**Severity:** No DB state update on confirmed payout  
**File:** `orders.py:631`  
**Reason deferred:** Depends on D1 (ledger). Fixing without the ledger means adding ad-hoc DB writes; better done as part of the full ledger integration.

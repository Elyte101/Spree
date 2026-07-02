# Notification Audit

Generated: 2026-07-02 | Phase 3 verification: PASSED (tsc 0 errors, 23/23 tests, build OK)

## USER Notifications

| ID | Event | Channel(s) | Recipient | Status |
|----|-------|-----------|-----------|--------|
| U1 | Vendor application submitted (docs_submitted) | in-app + email | vendor | FIXED — `onboarding.submit_onboarding()` correctly uses `notify()` |
| U2 | New vendor awaiting verification | in-app + email | all admins | FIXED — same call site as U1 |
| U3 | Seller approved | in-app + email | vendor | FIXED — `marketplace.approve_seller()` uses `notify()` |
| U4 | Seller rejected (with reason) | in-app + email | vendor | FIXED — `marketplace.reject_seller()` uses `notify()` with reason in body |
| U5 | Order placed / paid — buyer | in-app + email | buyer | FIXED — was missing; added `notify_safe()` in `_mark_order_paid()` and `create_order()` |
| U6 | New order received — seller | in-app + email | vendor | FIXED — upgraded from `create_notification()` to `notify_safe()` with `order_placed_seller` event |
| U7 | Order shipped (with tracking) | in-app + email | buyer | FIXED — upgraded to `notify_safe()` with `order_shipped` event; commit before notification |
| U8 | Order delivered / completed — buyer | in-app + email | buyer | FIXED — was missing; added `notify_safe()` in `confirm_delivery()` |
| U9 | Payout released — vendor | in-app + email | vendor | FIXED — upgraded to `notify_safe()` with `payout_released` event |
| U10 | Order cancelled — buyer | in-app + email | buyer | FIXED — was missing; added `notify_safe()` in `cancel_order()` |
| U11 | Order refunded | in-app + email | buyer | FIXED — upgraded from `create_notification()` to `notify_safe()` with `order_refunded` event |
| U12 | Payment failed (charge.failed webhook) | in-app + email | buyer | FIXED — upgraded to `notify_safe()` with `order_payment_failed` event |
| U13 | Payout transfer failed (transfer.failed webhook) | in-app + email | vendor | FIXED — upgraded to `notify_safe()` with `payout_failed` event |
| U14 | Low stock alert (vendor product ≤ 5 units) | in-app + email | vendor | FIXED — added to `_decrement_stock()` with `low_stock` event type |
| U15 | Onboarding reminder (cron, 24h stuck) | in-app + email | vendor | FIXED — was already using `notify()` in cron route |
| U16 | Password reset | email | user | SKIPPED — no password reset flow exists; no reset token endpoint in the codebase |

## DEVELOPER Notifications

| ID | Event | Channel(s) | Recipient | Status |
|----|-------|-----------|-----------|--------|
| D1 | Payment failure (charge.failed webhook) | log + dev email | dev team | FIXED — `dev_notifier.alert()` added in webhook handler |
| D2 | Paystack payout transfer failure | log + dev email | dev team | FIXED — `dev_notifier.alert()` added in webhook handler |
| D3 | Unhandled API exception | structured log | dev team | FIXED — `request_logging_middleware` already calls `logger.exception`; no change needed |
| D4 | ID document upload failure | log | dev team | SKIPPED — uploads are local filesystem; errors become HTTP 5xx and are logged by middleware |

## Architecture Changes Made

### New file: `backend/app/services/dev_notifier.py`
Centralised developer alert service. Logs at ERROR level and optionally emails `DEV_ALERT_EMAIL` via Resend. Never raises — all failures are swallowed with a WARNING log.

### New function: `notifications.notify_safe()`
Like `notify()` but catches and logs any exception instead of raising. Use when the notification is secondary to an already-committed main transaction.

### Updated: `backend/app/core/config.py`
Added `dev_alert_email: str = ""` setting.

### Updated: `backend/.env.example`
Added Resend, `DEV_ALERT_EMAIL`, VAPID, and `FRONTEND_URL` entries with documentation comments.

### Updated: `backend/app/services/notifications.py`
- Extended `DEFAULT_PREFS` with all new order/payout/stock event types.
- Extended `MANDATORY_EVENTS` to include buyer order events and payout events.
- `MANDATORY_EVENTS` now forces both `in_app=True` and `email=True` (was email-only).
- Added `notify_safe()` public helper.

### Updated: `backend/app/services/orders.py`
- All `create_notification()` calls upgraded to `notify_safe()` with proper `event_type` values.
- `_decrement_stock()` fires `low_stock` notification when product stock falls to ≤ 5.
- `_mark_order_paid()`: buyer gets `order_placed` notification; sellers get `order_placed_seller`.
- `add_tracking()`: commits before sending notification; uses `order_shipped` event.
- `confirm_delivery()`: buyer gets `order_delivered`; vendors get `payout_released` with transfer attempt.
- `cancel_order()`: buyer gets `order_cancelled`.
- `refund_order()`: upgraded to `notify_safe()` with `order_refunded`.
- Webhook `charge.failed`: fires `dev_notifier.alert()` + `order_payment_failed` to buyer.
- Webhook `transfer.failed`: fires `dev_notifier.alert()` + `payout_failed` to vendor.

### Updated: `types/types.ts`
`NotificationEventType` extended with all new event type literals:
`order_placed`, `order_shipped`, `order_delivered`, `order_cancelled`, `order_refunded`,
`order_payment_failed`, `order_placed_seller`, `payout_released`, `payout_failed`, `low_stock`.

## Verification Results

- `npx tsc --noEmit` — 0 errors
- `python -m pytest tests/ -v` — 23/23 passed
- `npm run build` — succeeded

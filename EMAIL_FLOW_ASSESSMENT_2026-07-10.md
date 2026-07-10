# Email Flow Assessment — 2026-07-10

Assessment of two drafted Claude Code prompts (auth emails; order emails) against the actual codebase.

## TL;DR
Both prompts assume features are missing that already exist. Running them as written would (a) create a **third** email code path, (b) reintroduce a **duplicate** verification flow, and (c) send **duplicate** order-confirmation/shipped emails. The real defects are a two-sender-domain split, signup not triggering the existing verification pipeline, and missing send-idempotency — not missing send code.

## Ground truth (verified in code)

Email is sent from TWO places, with TWO different default sender domains:
- Backend `app/services/notifications.py` → `_send_email()` uses the Python `resend` lib; `settings.email_from` default `Spree <no-reply@spree.com>`. Used by `notify`/`notify_safe`: order_placed, order_shipped, order_delivered, password_reset, payout, chat, etc. Errors are swallowed (`logger.warning`).
- Frontend `lib/email.ts` → `sendVerificationEmail()` uses the JS `resend` lib; `EMAIL_FROM` default `Spree <noreply@spree.market>`. Called only by `POST /api/auth/send-verification` (requires an authenticated session). Errors swallowed.

Already implemented, contrary to the prompts:
- `POST /api/v1/auth/verify-email` + `verify_email_token()` (flips `email_verified`). EXISTS.
- `create_verification_token()` (purpose="email_verification", 24h, single-active-token). EXISTS.
- `POST /api/v1/auth/send-verification` (backend) returns a token; the frontend route then emails it. EXISTS.
- `POST /api/v1/auth/password-reset/request` + `/confirm`, `request_password_reset()` / `reset_password_with_token()`: 1h token, generic no-leak response, session invalidation via `password_changed_at`, AND it sends the email via `notify_safe(event_type="password_reset")`. FULLY EXISTS.
- Order confirmation email: `_mark_order_paid()` calls `notify_safe(event_type="order_placed", recipient_email=order.email, ...)`. EXISTS.
- Shipped email: `add_tracking()` calls `notify_safe(event_type="order_shipped", ...)`. EXISTS.

No `extra=`-with-`message` logging bug currently exists in the backend (grep clean) — that guidance is still worth keeping as a rule, but there's nothing to fix.

## Prompt-by-prompt verdict

### Prompt 1A — signup verification email: PARTLY CORRECT
Real defect: `register_user()` sends a "welcome" email but never generates/sends a verification token, and the frontend signup route doesn't call the verification pipeline (user isn't logged in yet). So a new user is `email_verified:false` with no email — and MoMo checkout is gated on it.
Wrong assumptions: the verify-email endpoint and token generator already exist; don't add them. A new backend send would be a THIRD email path fighting `lib/email.ts`.

### Prompt 1B — password reset "unreachable/timeout": WRONG DIAGNOSIS
The endpoint and email send already exist and are correct. A 15s proxy timeout → `upstream_unreachable` means the request isn't completing at the network layer, OR the synchronous `resend.Emails.send()` inside `notify_safe` is blocking the response. This needs diagnosis (is the backend reachable? is Resend slow/hanging? is there an unhandled exception before the response?), not a reimplementation.

### Prompt 2 — order confirmation + shipped emails: WRONG PREMISE (would duplicate)
Both sends already exist via `notify_safe`. If they aren't arriving, the cause is the sender-domain/Resend config (below), guest recipients, or notification prefs — not absent code. The one legitimate gap: `_mark_order_paid()` is invoked from `verify_payment`, `submit_otp_for_order`, AND `handle_paystack_webhook`, with NO idempotency flag, so webhook retries can double-send the confirmation. Fix = idempotency stamp, not a new send.

## The actual root cause to chase first
Two verified-sender domains (`spree.com` vs `spree.market`). Resend rejects sends from any domain not verified in the account, and both code paths swallow the error. Whichever domain is unverified fails silently. This single issue plausibly explains the whole "some emails send, some don't" pattern. Decide on ONE domain, verify it in Resend, and point both `EMAIL_FROM` (frontend) and `email_from`/`EMAIL_FROM` (backend) at it.

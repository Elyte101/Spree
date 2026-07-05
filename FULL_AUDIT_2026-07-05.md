# Spree Full Audit — 2026-07-05

Scope: whole app (Next.js frontend + FastAPI backend). Automated checks run: `tsc --noEmit` (PASS, 0 errors), `eslint .` (5 errors, 17 warnings), Python `compileall` (PASS). Backend pytest and vitest could not run in this sandbox (no package registry access / native binaries); run `npm run verify` locally to confirm nothing below regresses.

Severity: C = critical (money loss / security / prod-breaking), H = high, M = medium.

---

## Critical

### C1 — Ledger service (G6) is never called anywhere
`app/services/ledger.py` (record_payment_received, record_commission_held, record_seller_credit, record_payout_initiated, record_refund_initiated) is dead code. Nothing in `orders.py` (payment confirm, payout release, refund) writes a LedgerEntry. SPEC_GAPS.md marks G6 "done" — it is not. There is no financial audit trail for any money movement.
**Fix:** call the ledger functions inside `_mark_order_paid`, `confirm_delivery`, `auto_release_delivered_orders`, and `refund_order`, in the same DB transaction as the state change.

### C2 — Buyer can cancel a PAID order with no refund and no stock restore
`cancel_order` (orders.py:1220) blocks only `in_transit/delivered/confirmed/paid_out`. A **paid** order can be cancelled by the buyer: status → "cancelled", the buyer's money is kept, no Paystack refund is triggered, decremented stock is never restored. The notification even says "If you paid, a refund will be processed" — nothing processes it.
**Fix:** if `status == "paid"`, either forbid buyer self-cancel or route through the refund flow; restore stock on cancel/refund; add `with_for_update()` (currently missing → races with confirm/track).

### C3 — Failed payouts are permanently stuck; no retry path
In `confirm_delivery`/`auto_release`, if a Paystack transfer fails the order stays "confirmed" with `payout_released_at` set. Retrying is impossible: `confirm_delivery` requires status "delivered", there is no admin retry endpoint, and the `transfer.failed` webhook only sends a notification. Seller money is stuck forever. Partial multi-seller failures are worse (some paid, order not `paid_out`, no record of which).
**Fix:** track per-seller payout state (use the ledger, C1), add an idempotent admin/cron "retry pending payouts" endpoint, handle `transfer.failed`/`transfer.success` webhooks by updating that state.

### C4 — In-memory verification sessions & rate limits break on Vercel
`verification_session.py` and `_check_rate_limit` (deps.py) are in-process dicts. `backend/vercel.json` deploys the backend serverless: the NIA lookup and face-verify calls land on different invocations, so `/identity/face-verify` will 404 "session not found or expired" in production. Rate limits also reset per invocation (comment limit, NIA 5/hr → useless).
**Fix:** back sessions and rate-limit buckets with the database (or Redis). Same for any other in-memory state.

### C5 — Live Paystack secret key still in backend/.env (AUDIT C1 never actioned)
`backend/.env` still contains an `sk_live_...` key on disk. It is not git-tracked, but the old audit flagged rotation and it hasn't happened.
**Fix (operator):** rotate keys in the Paystack dashboard; keep live keys only in deployment env vars.

### C6 — Stream chat webhook accepts unsigned requests when secret unset
`/webhooks/stream` (chat.py:157) skips signature verification entirely if `STREAM_WEBHOOK_SECRET` is empty. The endpoint is public and mounted outside `/api/v1`. Anyone can POST fake `message.new` events → burn Anthropic API credits and post spoofed "Spree Support" bot replies into any user's support channel.
**Fix:** in non-mock/production environments, reject requests when the secret is not configured (hard fail at startup like `_check_payment_config`), and always verify when set.

---

## High

### H1 — Items without productId accept the client-supplied price
`_server_totals` (orders.py:51-54): "Guest / external item with no productId — accept client price". A crafted checkout payload with productId omitted sets arbitrary prices in a real, payable order.
**Fix:** reject items without a valid productId in both payment flows (there is no legit guest-item use case in this app).

### H2 — Late `charge.success` for a cancelled order keeps the money
If an order goes "cancelled" (buyer cancel while pending, or `charge.failed` then MoMo retry succeeds late), a subsequent `charge.success` webhook is ignored (`order.status == "pending"` guard) — buyer charged, order dead, no refund, no alert.
**Fix:** in the webhook, if status is "cancelled" and charge succeeded, auto-refund via Paystack (or alert dev_notifier + admin for manual refund) and log a ledger entry.

### H3 — Idempotent replay of initialize-payment returns an empty authorizationUrl
orders.py:298-302: replay with same idempotencyKey returns `authorizationUrl: ""` — the client has nothing to redirect to, so a double-submit strands the buyer.
**Fix:** re-fetch/regenerate the Paystack authorization URL (or return the stored access_code) for pending orders on idempotent replay. Same issue in `charge_momo_payment` (returns generic "Processing…" with no real state).

### H4 — Backend /cart returns the first cart in the database — no user scoping
`get_cart_summary` (cart.py:12): `select(Cart).limit(1)` with no user filter; `Cart` has no user_id column. Whatever seed cart exists is served to every visitor (layout.tsx fetches it server-side on every page load). Real carts live only in localStorage (G20), so server cart is both wrong and useless.
**Fix:** either add per-user carts (Cart.user_id + session cookie for guests) or remove the backend cart endpoint and the layout fetch entirely.

### H5 — Admin pricing changes don't propagate across workers
`load_settings_from_db` mutates module globals (`PROCESSING_FEE_RATE`, `_BRACKETS`). With more than one uvicorn worker / serverless instance, only the instance that handled the admin update refreshes; others keep charging stale rates indefinitely.
**Fix:** read pricing settings per-request from the DB (cache with short TTL), not via process globals.

### H6 — Payout math is duplicated and already diverging
`confirm_delivery` and `auto_release_delivered_orders` contain two hand-copied ~90-line payout implementations. Any future fix applied to one will miss the other (this is how C3 got worse).
**Fix:** extract a single `_release_payout(db, order)` used by both.

### H7 — auto_release error handler can crash itself
orders.py:1210: `except` block logs `order.id`, but if the exception fired before `order` was assigned (first iteration), `order` is unbound → NameError inside the handler; remaining orders in the batch are skipped.
**Fix:** log `order_id` (the loop variable) instead.

### H8 — Legacy admin `create_order` bypasses all money safeguards
Trusts client-sent subtotal/total/item prices, marks "paid" without payment, never decrements stock, writes no ledger. Admin-only, but one compromised/mistaken admin call corrupts money records silently.
**Fix:** recompute totals server-side like `initialize_payment`, decrement stock, write ledger entries — or delete the endpoint if unused.

---

## Medium

### M1 — Chat client never disconnects on logout / user switch
`ChatWidget.tsx` module-level `_client` singleton: after logout+login as another user in the same tab, `_client.userID` is still set, so the new user reuses the previous user's Stream connection (sees their support channel). No `disconnectUser()` anywhere.
**Fix:** disconnect and null the singleton when session user id changes or on signout.

### M2 — Stream users are upserted with their ID as display name
chat.py:85 `{"name": actor_id}` — admin dashboard shows raw user IDs instead of names, and it overwrites any proper name on every token fetch.
**Fix:** pass the user's real name from the DB.

### M3 — Synchronous Claude call inside the Stream webhook
The webhook blocks for the whole Anthropic request. Stream retries slow webhooks → duplicate AI replies. No dedup by message id.
**Fix:** respond 200 immediately and run the AI reply in a background task keyed by message id.

### M4 — Leftover "image provision" artifacts after camera-based verification
Dead remnants of the removed upload flow: `/uploads/{path}` route in main.py, `app/services/uploads.py`, `id_front_url`/`id_back_url`/`selfie_url` columns + encryption handling, admin vendor documents route/UI. Confusing and expands attack surface.
**Fix:** remove them (keep an eye on admin UI references), or explicitly document why they stay.

### M5 — Re-verification with a different Ghana Card keeps the old number
identity.py:132: encrypted card number saved only `if not user.government_id_number`. A user whose first lookup used card A but who verifies with card B ends up verified with card A stored and hashed.
**Fix:** always overwrite number+hash with the card from the verified session at face-verify success time.

### M6 — Money serialized as float in catalog/cart/auth responses
`float()` casts throughout catalog.py, cart.py, auth.py (G12 fixed orders only). Display-level, but inconsistent and can drift by a pesewa vs. server Decimal totals.
**Fix:** serialize as strings like `_order_to_dict` does.

### M7 — ESLint: 5 errors, 17 warnings
Errors: `react/no-unescaped-entities` ×5 in `components/vendor/steps/Step4Identity.tsx` (lines 165, 266, 284, 350, 390). Warnings (unused vars/imports, hook deps) across 12 files incl. `useMomoResolve.ts`, `AdminChatPage.tsx`, `checkoutPage`-adjacent components. `npm run lint` currently fails → CI/verify gate is red.

### M8 — requirements.txt has no trailing newline
Last line `anthropic>=0.25.0` concatenates with the next file when catted/merged; also trips some tooling. Add newline.

### M9 — Spec/docs drift
SPEC_GAPS.md: G6 marked done (false — see C1); G24 "admin chat missing" (stale — Stream support chat now exists). PAYMENT_FIXES.md and AUDIT.md don't reflect current state. Update docs after this fix pass.

### M10 — Order state machine states `processing`/`pre_transit` are defined but unreachable
add_tracking jumps paid → in_transit directly. Either wire the intermediate states (G8 spec) or remove them from types/UI maps.

---

## Verified OK (no action)
- tsc clean; Python compiles.
- Webhook signature verification for Paystack (when not mock); internal-key proxy pattern; path-traversal guard on /uploads; scrypt password hashing with constant-time compare; atomic stock decrement with oversell guard; refund-before-Paystack idempotency ordering; per-order SKIP LOCKED in auto-release; marginal commission brackets monotonic; Ghana Card uniqueness check with race re-check at face-verify; NIA photo kept server-side; XSS strip + comment rate limit (in-memory caveat C4).

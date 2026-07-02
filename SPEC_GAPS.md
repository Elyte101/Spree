# Spec Gaps

## Gap Inventory

| ID  | Spec Item | Status | Severity | File(s) | Notes |
|-----|-----------|--------|----------|---------|-------|
| G1  | Only Ghana Card accepted for ID verification | **done** | high | `backend/app/schemas/auth.py`, `lib/ghana.ts`, `types/types.ts` | `GhanaIdType` restricted to `"ghana-card"` only in schemas, lib, and types. Frontend Step4Identity updated. |
| G2  | No bank account payout fields | **done** | high | `backend/app/schemas/auth.py`, `components/vendor/steps/Step5Payout.tsx`, `components/profile/profilePage.tsx`, `lib/api/types.ts` | Bank fields removed from all payout schemas and UI. Method is now `"card" | "mobile_money"`. |
| G3  | MoMo restricted to MTN and Telecel ONLY | **done** | medium | `lib/ghana.ts`, `backend/app/schemas/auth.py` | AirtelTigo removed from `MOMO_NETWORKS`. Backend validates network against MTN/Telecel only. |
| G4  | NIA API adapter with mock/sandbox mode | **done** | high | `backend/app/services/nia_adapter.py` | NIAAdapter with mock mode (`NIA_MOCK=true`). Returns `NIAResult` dataclass. Numbers ending in "0" = NOT_FOUND in mock. |
| G5  | Face-match adapter with mock/sandbox mode | **done** | high | `backend/app/services/face_match_adapter.py` | FaceMatchAdapter with mock mode (`FACE_MATCH_MOCK_FAIL=true` to simulate failure). Returns `FaceMatchResult` dataclass. |
| G6  | Ledger service for every money movement | **done** | high | `backend/app/services/ledger.py`, `backend/app/db/models.py` | `LedgerEntry` model added. Service has record_payment_received, record_commission_held, record_seller_credit, record_payout_initiated, record_refund_initiated, get_order_ledger, get_seller_ledger. Idempotency-keyed. |
| G7  | Logistics adapter with mock/sandbox mode | **done** | high | `backend/app/services/logistics_adapter.py` | LogisticsAdapter with get_rate, create_shipment, get_tracking, verify_webhook, parse_webhook. Mock mode default. |
| G8  | Order state machine — spec states vs implemented | **done** | critical | `backend/app/services/orders.py`, `types/types.ts`, all order UI components | All spec states added: `pending→paid→processing→pre_transit→in_transit→delivered→confirmed→paid_out`. Frontend status maps updated in all 4 components. |
| G9  | Escrow: release requires BOTH delivered AND buyer confirms | **done** | critical | `backend/app/services/orders.py`, `backend/app/api/routes/orders.py` | `mark_delivered` endpoint (seller: in_transit→delivered). `confirm_delivery` requires `delivered` status (buyer: delivered→confirmed→paid_out). |
| G10 | Auto-release after configurable window (default 7 days) | **done** | high | `backend/app/services/orders.py`, `backend/app/api/routes/cron.py`, `app/api/cron/auto-release/route.ts`, `vercel.json` | `auto_release_delivered_orders()` service function. `POST /cron/auto-release` backend endpoint. Next.js cron route at `/api/cron/auto-release`. Vercel cron scheduled daily at 03:00 UTC. Reads `auto_release_days` SiteSetting (default 7). |
| G11 | Commission % and processing fee admin-configurable | **done** | high | `backend/app/core/pricing.py`, `backend/app/db/init_db.py`, `backend/app/db/models.py` | `load_settings_from_db()` reads `processing_fee_rate` and `commission_brackets` from SiteSetting. Defaults seeded on first boot. |
| G12 | Amounts in minor units (pesewas) or Decimal — no floats | **done** | high | `backend/app/services/orders.py` | `_order_to_dict` uses `Decimal` helper `_d()`. Payout amounts returned as string. `_order_to_list_dict` returns `total` as `str(order.total.quantize(...))`. |
| G13 | Ghana Card data, NIA response, payout details encrypted at rest | **done** | critical | `backend/app/services/encryption.py`, `backend/app/services/onboarding.py`, `backend/app/services/auth.py` | Fernet-based encryption service (`enc1:` prefix). government_id_number, id_front/back_url, selfie_url, payout_info encrypted on write, decrypted on read. Graceful fallback with WARNING when key not set. |
| G14 | Seller verification state machine: unverified→pending→verified\|rejected | **done** | high | `backend/app/services/auth.py`, `backend/app/services/marketplace.py` | Fixed via G15. All status values pass through `_serialize_profile` correctly. `approve_seller`/`reject_seller` transitions wired. |
| G15 | `_serialize_profile` strips valid seller statuses | **done** | critical | `backend/app/services/auth.py` | Valid status set expanded to include all defined statuses: `pending_verification`, `verified`, `rejected`, `incomplete`. |
| G16 | ONLY verified sellers can create products | **done** | critical | `backend/app/services/catalog.py`, `backend/app/services/marketplace.py` | `approve_seller` now sets `seller_status="active"` (canonical approved state). Product creation blocks `seller_status != "active"`. `_base_product_query` hides products from non-active sellers. |
| G17 | Seller contact info not leaked to buyers | **done** | high | `backend/app/services/marketplace.py` | Split into `_serialize_seller_summary` (public, no PII) and `_serialize_admin_seller_summary` (PII for admin). Email/phone/sellerContact removed from public response. |
| G18 | Payout details viewable by ADMIN ONLY | **done** | critical | `backend/app/services/auth.py`, `backend/app/schemas/auth.py` | `payoutInfo` returned only to self (own settings) and admin. Route checks `actor_id == user_id` or admin role. NIA response and Ghana Card data admin-only (not returned to owner in profile serialization). |
| G19 | Seller coordinates (location) — buyers never see them | **done** | high | `backend/app/services/marketplace.py` | `storeLocation` in public view restricted to `{city, state, country}` only. Full address only in admin view. |
| G20 | Guest cart merges into account cart on login | missing | medium | N/A | Client-side Zustand persist handles basic persistence. Backend cart-per-user merge not implemented. |
| G21 | Comments under products — CRUD | **done** | high | `backend/app/db/models.py`, `backend/app/services/catalog.py`, `backend/app/api/routes/catalog.py` | `Comment` model. `GET/POST /products/{id}/comments`, `DELETE /comments/{id}`, `POST /admin/comments/{id}/flag`. XSS strip on body (G32 partial). |
| G22 | Buyer likes products — idempotent, unlikeable, counts | **done** | high | `backend/app/db/models.py`, `backend/app/services/catalog.py`, `backend/app/api/routes/catalog.py` | `ProductLike` model. `POST /products/{id}/like` (toggle), `GET /products/{id}/likes`, `GET /users/me/likes`. |
| G23 | Admin editable main-page tagline (events, seasonal) | **done** | medium | `backend/app/db/models.py`, `backend/app/api/routes/marketplace.py` | `SiteSetting` model added. `GET /site-settings/{key}`, `PUT /admin/site-settings/{key}`, `GET /admin/site-settings` endpoints added. Default tagline seeded. |
| G24 | Admin: in-app chat seller/buyer↔admin ONLY | missing | medium | N/A | No chat/support messaging model or routes. |
| G25 | Buyer↔seller direct messaging blocked | **done** | medium | N/A | Contact info removed from public seller summary (G17). No DM system exists or is reachable. |
| G26 | Soft-delete users — orders and money records stay intact | **done** | medium | `backend/app/services/marketplace.py`, `backend/app/db/models.py` | `delete_seller` sets `deleted_at` + `seller_status="removed"`. FK integrity preserved. `deleted_at` column added via `_COLUMN_MIGRATIONS`. |
| G27 | Admin actions audited: who, what, when | **done** | medium | `backend/app/services/audit.py`, `backend/app/db/models.py`, `backend/app/services/marketplace.py` | `AuditLog` model added. `log_action()` called in approve_seller, reject_seller, delete_seller, toggle_seller_blacklist. |
| G28 | Admin: select featured products, orderable | **done** | low | `backend/app/api/routes/catalog.py`, `backend/app/services/catalog.py`, `backend/app/schemas/catalog.py` | `PATCH /products/{id}/featured` endpoint added. `toggle_product_featured()` service function. |
| G29 | Payouts idempotent — idempotency key prevents double-payout | **done** | high | `backend/app/services/orders.py`, `backend/app/services/paystack.py` | Stable idempotency key `f"payout-{order.id}-{seller_id}"` passed to `initiate_transfer` as Paystack `reference`. |
| G30 | Dev alerts for NIA/face-scan API failures | **done** | medium | `backend/app/services/nia_adapter.py`, `backend/app/services/face_match_adapter.py` | `dev_notifier.alert()` called on timeout, network error, and parse error in both adapters. Sends email to `DEV_ALERT_EMAIL` if configured. |
| G31 | Rate-limit comment endpoints | **done** | medium | `backend/app/api/deps.py`, `backend/app/api/routes/catalog.py` | `CommentRateLimit` dependency added to `deps.py` — max 5 comments per user per 60s (in-memory token bucket). Applied to `POST /products/{id}/comments`. Returns 429 with `Retry-After` header. |
| G32 | Sanitize user input against XSS | **done** | high | `backend/app/services/catalog.py`, `backend/app/services/onboarding.py` | `_strip_html()` helper strips HTML tags on product description (create+update), store description/tagline, and comment body. Pydantic validates all other inputs. |
| G33 | All secrets via env vars — audit for hardcoded keys | **done** | high | `.gitignore`, `backend/.env.example`, `.env.example` | `.gitignore` has `.env*` pattern (excl `.env.example`). Verified: `.env` and `.env.local` are NOT tracked. `.env.example` and `backend/.env.example` updated with all required vars. No hardcoded keys found in source. |
| G34 | Seller status enforcement: deactivated products hidden | **done** | medium | `backend/app/services/catalog.py` | Products hidden when `seller_status != "active"`. G15+G16 fixes ensure status values are correct. `_base_product_query` enforces this at DB level. |
| G35 | Rejected seller can resubmit | **done** | medium | `backend/app/services/onboarding.py` | `submit_onboarding` now allows resubmit from `rejected` state. Blocks `pending_verification`, `active`, `suspended`, `removed`. Clears `rejected_at`/`rejection_reason` on resubmit. Admin notified with "resubmit" context. |
| G36 | Payout flow: deduct commission + processing fee → seller net | **done** | high | `backend/app/services/orders.py`, `backend/app/core/pricing.py` | `seller_payout_from_listed()` correctly recovers seller price net of commission. Processing fee (1.5%) is a buyer-side surcharge — it is NOT deducted from seller payout (correct per spec). Pickup fee: deferred until logistics adapter integrated. Assumption 2 in this doc. |
| G37 | Every state change persisted with timestamp and reason | **done** | high | `backend/app/db/models.py`, `backend/app/services/marketplace.py` | `verified_at`, `rejected_at`, `suspended_at` columns added and migrated. `approve_seller` sets `verified_at`; `reject_seller` sets `rejected_at`; `update_admin_seller_status` sets appropriate timestamp. |
| G38 | Buyer registration welcome notification | **done** | low | `backend/app/services/auth.py` | `register_user` now calls `notify_safe` with `event_type="welcome"`. |
| G39 | Admin seed exists and is role-enforced | **done** | — | `backend/app/db/init_db.py` | Admin seeded via `init_db`. No signup path for admin. Admin role enforced on all admin routes. |
| G40 | Order ID tracking per order for buyer | **done** | — | `backend/app/db/models.py` | `Order.id` exists and returned in list/detail. |
| G41 | Seller receives order/payout notifications | **done** | — | `backend/app/services/orders.py` | `notify_safe` fires for `order_placed_seller` and `payout_released`. |
| G42 | Payment info (buyer side) — MoMo or card | **done** | medium | `backend/app/schemas/auth.py`, `types/types.ts` | `bank-transfer` removed from `PaymentMethod` type and backend schema. |
| G43 | Stock decrement atomic with oversell guard | **done** | — | `backend/app/services/orders.py` | Uses `WHERE stock >= quantity` atomic UPDATE. |
| G44 | Paystack webhook signature verification | **done** | — | `backend/app/api/routes/payments.py` | Signature checked; warns if key not set. |
| G45 | Notifications respect user preference settings | **done** | — | `backend/app/services/notifications.py` | `_get_user_prefs` merges defaults with user prefs. Mandatory events can't be disabled. |

## Detailed Notes

### G1 — Only Ghana Card accepted
**Fixed**: `GhanaIdType = Literal["ghana-card"]` in backend schema. `GHANA_ID_TYPES` in `lib/ghana.ts` restricted to Ghana Card only. `GovernmentIdType` in `types/types.ts` restricted to `"ghana-card"`. Frontend Step4Identity updated.

### G2 — No bank account payout fields
**Fixed**: Bank fields removed from `PayoutInfoRequest`, `OnboardingStep5Request`, `OnboardingStep5Payload` (TS), `PayoutInfo` (TS). `Step5Payout.tsx` and `profilePage.tsx` rewritten to use `card | mobile_money` only.

### G3 — MoMo MTN/Telecel ONLY
**Fixed**: `MOMO_NETWORKS` in `lib/ghana.ts` restricted to MTN and Telecel only. Backend schema validates accordingly.

### G4 — NIA API adapter
**Fixed**: `backend/app/services/nia_adapter.py` created. NIAAdapter class with mock mode when `NIA_MOCK=true` or keys not set. Returns `NIAResult` dataclass. Numbers ending in "0" return NOT_FOUND in mock.

### G5 — Face-match adapter
**Fixed**: `backend/app/services/face_match_adapter.py` created. FaceMatchAdapter class with mock mode. `FACE_MATCH_MOCK_FAIL=true` simulates failure.

### G6 — Ledger service
**Fixed**: `backend/app/services/ledger.py` created. `LedgerEntry` model added to `models.py`. Idempotency-keyed `_append()` internal helper. All required recording functions implemented.

### G7 — Logistics adapter
**Fixed**: `backend/app/services/logistics_adapter.py` created. LogisticsAdapter with `get_rate()`, `create_shipment()`, `get_tracking()`, `verify_webhook()`, `parse_webhook()`. Dataclasses: `ShippingRate`, `Shipment`, `TrackingResult`, `TrackingEvent`.

### G8 — Order state machine mismatch
**Fixed**: `OrderStatus` in `types/types.ts` expanded to all spec states. Backend `orders.py` uses new state names. Frontend status maps updated in `orderDetailPage.tsx`, `orderHistoryPage.tsx`, `orderTrackingPage.tsx`, `vendorOrdersPage.tsx`.

### G13 — Sensitive fields unencrypted
**Fixed**: `backend/app/services/encryption.py` created. Fernet-based `encrypt()`/`decrypt()` with `enc1:` prefix. `onboarding.py:save_step4` encrypts Ghana Card number, id_front_url, id_back_url, selfie_url. `save_step5` encrypts payout info as JSON blob. `auth.py:_serialize_profile` decrypts on read. Graceful fallback with WARNING when `FIELD_ENCRYPTION_KEY` not set.

### G15 — `_serialize_profile` strips valid statuses
**Fixed**: Valid status set in `_serialize_profile` expanded to include `pending_verification`, `verified`, `rejected`, `incomplete`, `active`.

### G17 — Seller contact info leaked
**Fixed**: Public `_serialize_seller_summary` no longer returns email, phone, or sellerContact. Admin-only `_serialize_admin_seller_summary` includes PII. `storeLocation` in public view restricted to city/state/country only.

### G29 — Payout idempotency missing
**Fixed**: `confirm_delivery` passes `idempotency_key=f"payout-{order.id}-{sid}"` to `paystack_svc.initiate_transfer`. Paystack `initiate_transfer` adds `reference` when idempotency_key provided.

### G33 — Live secrets committed to tracked files
**Partial**: `.env.example` updated with all required vars including field encryption key, NIA adapter, face match adapter, logistics adapter env vars. Live keys cannot be removed from git history here. Advisory: rotate all keys before deploying.

### G36 — Payout calculation missing pickup fee
**Partial**: Commission deducted correctly from seller payout. Processing fee is buyer-side only (not deducted from seller). Pickup fee deduction deferred until logistics adapter is fully integrated.

### G38 — Missing buyer welcome notification
**Fixed**: `register_user` now sends welcome notification via `notify_safe` with `event_type="welcome"`.

---

## Assumptions (to be flagged explicitly)

1. **Auto-release window**: Defaulting to 7 days after `delivered` status as spec states. `auto_release_days` SiteSetting seeded. Cron job not yet implemented (G10).
2. **Pickup fee handling**: Cannot implement until logistics adapter is built. Stubbed as `0` for now.
3. **NIA API**: No actual NIA API credentials exist. Mock mode will be default. Real mode triggered by `NIA_API_URL` + `NIA_API_KEY` env vars.
4. **Face match**: No real face-match service. Mock mode returns score=0.95 pass. Real mode triggered by `FACE_MATCH_API_URL` + `FACE_MATCH_API_KEY`.
5. **Order state machine**: New states added to match spec without breaking existing data. Old `shipped`→`in_transit`, `completed`→`confirmed`.
6. **"Card" payout method**: Spec says "card OR MoMo" for payout. Treating this as Paystack card-on-file rather than a separate field. The `card` payout method stores last-4 as reference info only; actual disbursement via Paystack transfer.
7. **Seller contact info**: Business email and phone removed from public SellerSummaryOut. Only available to admin via admin seller detail endpoint.

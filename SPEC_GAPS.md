# Spec Gaps

## Gap Inventory

| ID  | Spec Item | Status | Severity | File(s) | Notes |
|-----|-----------|--------|----------|---------|-------|
| G1  | Only Ghana Card accepted for ID verification | partial | high | `backend/app/schemas/auth.py:72`, `lib/ghana.ts:210-216`, `components/vendor/steps/Step4Identity.tsx:558` | `GhanaIdType` allows voters-id, drivers-license, passport, ecowas-card, ssnit. Frontend Step4Identity and old vendorApplicationWizard show all types. Spec says Ghana Card ONLY. |
| G2  | No bank account payout fields | partial | high | `backend/app/schemas/auth.py:97-104`, `components/vendor/steps/Step5Payout.tsx`, `backend/app/services/onboarding.py:146-155` | Bank transfer method and bank fields exist throughout. Spec says card OR MoMo (MTN/Telecel only). |
| G3  | MoMo restricted to MTN and Telecel ONLY | partial | medium | `lib/ghana.ts:344-348`, `lib/momo/providers.ts`, `components/vendor/steps/Step5Payout.tsx` | MOMO_NETWORKS includes AirtelTigo Money. Spec says MTN and Telecel ONLY. Backend MoMo charge sends provider string to Paystack without restricting to MTN/Telecel. |
| G4  | NIA API adapter with mock/sandbox mode | missing | high | N/A | No `backend/app/services/nia_adapter.py` exists. ID number is saved but never verified against NIA. No NIA call, no returned details for applicant to confirm, no retry path. |
| G5  | Face-match adapter with mock/sandbox mode | missing | high | N/A | No `backend/app/services/face_match_adapter.py` exists. Selfie is uploaded but never matched against card photo. |
| G6  | Ledger service for every money movement | missing | high | N/A | No `backend/app/services/ledger.py`. No ledger entries recorded. Spec requires record_charge, record_escrow_hold, record_fee_deduction, record_payout, record_refund, assert_balance. |
| G7  | Logistics adapter with mock/sandbox mode | missing | high | N/A | No `backend/app/services/logistics_adapter.py`. Shipment/tracking is manual (seller enters tracking number via UI). No rider-pickup vs seller-dropoff modes. No webhook endpoint for logistics status updates. |
| G8  | Order state machine — spec states vs implemented | partial | critical | `backend/app/services/orders.py` | Spec states: `pending_payment→paid(escrow)→processing→pre_transit→in_transit→delivered→confirmed→paid_out`. Implemented: `pending→paid→shipped→completed→cancelled`. Missing states: `pending_payment`, `processing`, `pre_transit`, `in_transit`, `delivered`, `confirmed`, `paid_out`. |
| G9  | Escrow: release requires BOTH delivered AND buyer confirms | partial | critical | `backend/app/services/orders.py:879-980` | Payout triggered on `confirm_delivery` (buyer action only), which is correct. But order goes directly to `completed` and payout fires. No separate `delivered` status before buyer confirms. `shipped→completed` skips `delivered` state. |
| G10 | Auto-release after configurable window (default 7 days) | missing | high | N/A | No cron job or task to auto-release escrow if buyer never confirms after delivery. No configurable window in settings. |
| G11 | Commission % and processing fee admin-configurable | partial | high | `backend/app/core/pricing.py` | Processing fee (1.5%) and commission brackets are hardcoded in `pricing.py`. Spec requires admin-configurable, snapshotted at checkout time. |
| G12 | Amounts in minor units (pesewas) or Decimal — no floats | partial | high | `backend/app/services/orders.py:167-177` | `_order_to_dict` uses `float()` throughout. Payout amounts, totals serialized as Python floats. DB stores `Numeric(10,2)` which is correct, but API output uses float. |
| G13 | Ghana Card data, NIA response, payout details encrypted at rest | missing | critical | `backend/app/db/models.py:171-177,184-186` | `government_id_number`, `payout_info`, `id_front_url`, `id_back_url`, `selfie_url` stored as plain text/JSON. No encryption. |
| G14 | Seller verification state machine: unverified→pending→verified|rejected | partial | high | `backend/app/services/marketplace.py:441,463`, `backend/app/services/onboarding.py:180` | Transitions exist but only partially. State `unverified` maps to `buyer`. `pending_verification` is set on submit. `verified`/`rejected` set on admin action. But `_serialize_profile` in auth.py strips `pending_verification`, `verified`, `rejected` from valid statuses (line 128-134). |
| G15 | `_serialize_profile` strips valid seller statuses | critical | critical | `backend/app/services/auth.py:128-134` | `seller_status` defaults to `"buyer"` for any value not in `{"buyer","pending","active","suspended","removed"}`. Statuses `pending_verification`, `verified`, `rejected`, `incomplete` get coerced to `"buyer"`, losing state. |
| G16 | ONLY verified sellers can create products | partial | critical | `backend/app/services/catalog.py:613` | Check is `seller_status != "active"`. With G15 bug, `pending_verification`/`verified` vendors show as `buyer` in profile serialization. The product route checks actual DB value correctly, but state inconsistency is confusing. Per spec, only `verified` sellers should create products — enforced as `active` in current code. |
| G17 | Seller contact info not leaked to buyers | partial | high | `backend/app/services/marketplace.py:116-156`, `backend/app/schemas/marketplace.py:16-43` | `SellerSummaryOut` includes `email`, `phone`, `sellerContact` (businessEmail, businessPhone, whatsapp). These are visible to anyone who calls `/sellers/{id}`. Spec: guests never see seller contact info. |
| G18 | Payout details viewable by ADMIN ONLY | partial | critical | `backend/app/services/auth.py:178`, `backend/app/schemas/auth.py:148` | `_serialize_profile` returns `payoutInfo` to the profile owner (self). The route at `GET /auth/profile/{user_id}` allows admin or self to read. Self seeing own payout info is fine. But `AdminSellerDetailOut` is correct (only admin). However `UserProfileOut.payoutInfo` is currently sent via the `/api/profile` route to the user themselves — which may be intentional for settings. Need to audit whether buyer profile endpoint leaks other users' payout. Route checks `actor_id == user_id` — looks correct. |
| G19 | Seller coordinates (location) — buyers never see them | partial | high | `backend/app/services/marketplace.py:130-133` | `storeLocation` dict returned in `SellerSummaryOut` includes `addressLine1`, `city`, `state`, `postalCode`, `country`. Full address visible. Spec: only admin and logistics can read coordinates. City/country for display may be ok; full address line is over-exposed. |
| G20 | Guest cart merges into account cart on login | missing | medium | N/A | No cart merge logic in auth flow. Guest adds to localStorage cart; on login, no merge-and-dedupe happens. |
| G21 | Comments under products — CRUD | missing | high | N/A | No Comment model, no comment routes in backend. No comment UI in frontend product detail page. |
| G22 | Buyer likes products — idempotent, unlikeable, counts | missing | high | N/A | No ProductLike model or routes in backend. FavoritesPage and favoritesStore exist in frontend but appear to be local/client-side only. |
| G23 | Admin editable main-page tagline (events, seasonal) | missing | medium | N/A | No `SiteSetting` model or admin endpoint for editing homepage tagline. |
| G24 | Admin: in-app chat seller/buyer↔admin ONLY | missing | medium | N/A | No chat/support messaging model or routes. |
| G25 | Buyer↔seller direct messaging blocked | partial | medium | N/A | No messaging system exists at all, which means no DM capability either. Good. But `sellerContact` fields (phone, whatsapp, email) leak contact info (see G17). |
| G26 | Soft-delete users — orders and money records stay intact | missing | medium | `backend/app/services/marketplace.py:391-399` | `delete_seller` does a hard `db.delete(vendor)`. No soft-delete. Orders with `user_id` / `seller_id` FK would break or cascade-delete. |
| G27 | Admin actions audited: who, what, when | missing | medium | N/A | No `AuditLog` model. Admin approve/reject/blacklist/deactivate actions not recorded with actor+timestamp. |
| G28 | Admin: select featured products, orderable | partial | low | `backend/app/db/models.py:97` | `is_featured` column exists, `is_new_arrival` column exists. Admin top-products endpoint exists. But no API to toggle featured on a specific product or reorder featured products. |
| G29 | Payouts idempotent — idempotency key prevents double-payout | partial | high | `backend/app/services/orders.py:950` | Paystack transfer called inside `confirm_delivery`. No idempotency key passed to `paystack_svc.initiate_transfer`. If confirm_delivery is retried, transfer could fire twice. |
| G30 | Dev alerts for NIA/face-scan API failures | missing | medium | N/A | NIA and face-match adapters don't exist yet. Once added, dev_notifier should fire on API failures. |
| G31 | Rate-limit comment endpoints | missing | medium | N/A | Comments don't exist yet. When added, rate-limiting needed. |
| G32 | Sanitize user input against XSS | partial | high | N/A | Backend uses Pydantic validation. No explicit HTML sanitization for text fields that could be rendered (product descriptions, store descriptions, comments). |
| G33 | All secrets via env vars — audit for hardcoded keys | partial | high | `backend/.env` | Live Paystack keys (`sk_live_...`) committed to `.env`. Should be in `.env` (not committed) or env var injection. `.env.local` also has live keys and DB passwords. Neither file is in `.gitignore` apparently — need to verify. |
| G34 | Seller status enforcement: deactivated products hidden | partial | medium | `backend/app/services/catalog.py:205-216` | Products hidden when `seller_status != "active"`. But the status enum confusion (G15) means `verified`/`pending_verification` sellers' products appear based on DB value not serialized value. |
| G35 | Rejected seller can resubmit | partial | medium | `backend/app/services/marketplace.py:463-488` | `seller_status = "rejected"` is set. Resubmit path: unclear, but onboarding submit checks no guard against rejected state (could resubmit). However `_serialize_profile` strips `rejected` to `buyer` (G15). |
| G36 | Payout flow: deduct commission + processing fee → seller net | partial | high | `backend/app/services/orders.py:903-916` | `confirm_delivery` uses `seller_payout_from_listed` which recovers seller price from commission. But processing fee (buyer-side 1.5%) is NOT deducted from seller payout. Pickup fee not deducted either (logistics not implemented). Net amount calculation may be incorrect per spec. |
| G37 | Every state change persisted with timestamp and reason | partial | high | `backend/app/db/models.py` | Order has `paid_at`, `shipped_at`, `delivered_at`, `payout_released_at`. But no full audit trail per state transition (who triggered it, all timestamps, reason). User `seller_started_at` is the only seller state timestamp. No `rejected_at`, `verified_at`, `suspended_at`. |
| G38 | Buyer registration welcome notification | missing | low | `backend/app/services/auth.py:199-228` | `register_user` sends no welcome notification to new buyer. |
| G39 | Admin seed exists and is role-enforced | done | — | `backend/app/db/init_db.py:102-117` | Admin seeded via `init_db`. No signup path for admin. Admin role enforced on all admin routes. |
| G40 | Order ID tracking per order for buyer | done | — | `backend/app/db/models.py:287` | `Order.id` exists and returned in list/detail. |
| G41 | Seller receives order/payout notifications | done | — | `backend/app/services/orders.py` | `notify_safe` fires for `order_placed_seller` and `payout_released`. |
| G42 | Payment info (buyer side) — MoMo or card | partial | medium | `backend/app/schemas/auth.py:57-70` | `PaymentInfo` has `method: Literal["card", "bank-transfer", "mobile_money"]`. `bank-transfer` shouldn't be a buyer payment method per spec (buyer pays MoMo or card only). |
| G43 | Stock decrement atomic with oversell guard | done | — | `backend/app/services/orders.py:99-149` | Uses `WHERE stock >= quantity` atomic UPDATE. |
| G44 | Paystack webhook signature verification | done | — | `backend/app/api/routes/payments.py:53-60` | Signature checked; warns if key not set. |
| G45 | Notifications respect user preference settings | done | — | `backend/app/services/notifications.py` | `_get_user_prefs` merges defaults with user prefs. Mandatory events can't be disabled. |

## Detailed Notes

### G1 — Only Ghana Card accepted
The spec explicitly states: "ONLY the Ghana Card is accepted. Remove any passport/license fields." Currently:
- `GhanaIdType` in `backend/app/schemas/auth.py` accepts 6 types
- `GHANA_ID_TYPES` in `lib/ghana.ts` lists 6 types
- Both onboarding wizards (`Step4Identity.tsx` and `vendorApplicationWizard.tsx`) show a dropdown with all 6 types
- Backend `onboarding.py:save_step4` validates Ghana Card number only when type is `ghana-card`
**Fix**: Restrict `GhanaIdType` to `"ghana-card"` only. Remove the dropdown (or make it non-editable, pre-set). Remove other validation specs.

### G2 — No bank account payout fields
The spec says "Payout details: card OR MoMo (MTN/Telecel only). NO bank account fields anywhere."
Currently `PayoutInfoRequest` and `OnboardingStep5Request` include `bankName`, `accountNumber`, `bankCode`. `Step5Payout.tsx` renders a bank section.
**Fix**: Remove bank fields from payout schemas and UI. Change method to `Literal["card", "mobile_money"]`.

### G3 — MoMo MTN/Telecel ONLY
AirtelTigo Money is in `MOMO_NETWORKS` in `lib/ghana.ts` and referenced in `lib/momo/providers.ts`. Spec: MTN and Telecel only.
**Fix**: Remove `AirtelTigo Money` from `MOMO_NETWORKS`. Update prefix reference table. Update backend MoMo network validation.

### G4 — NIA API adapter missing
No NIA verification happens. Ghana Card number is saved to DB but never queried against NIA. The spec requires the full flow: submit card number → NIA returns name/dob/photo → display for applicant to confirm → mismatch = fail with reason + retry.
**Fix**: Create `backend/app/services/nia_adapter.py` with interface and mock. Call from `onboarding.py:save_step4`.

### G5 — Face-match adapter missing
Selfie photo is uploaded but never compared to Ghana Card photo from NIA. Spec requires Binance-style guided selfie → match score → pass/fail.
**Fix**: Create `backend/app/services/face_match_adapter.py` with interface and mock. Call from onboarding step 4 or submit.

### G6 — Ledger service missing
No money ledger. All financial flows happen via Paystack directly with no local audit trail. The spec requires every money movement (charge, escrow hold, fee deduction, payout, refund) to be a ledger entry with balance assertion.
**Fix**: Create `backend/app/services/ledger.py` with all required methods and a `LedgerEntry` model.

### G7 — Logistics adapter missing
No logistics integration. Seller manually enters tracking number via the dashboard. Spec requires:
- Rider pickup (logistics dispatches rider from seller coordinates) vs seller drop-off mode
- Every shipment tracked: `pre_transit→in_transit→delivered`
- Webhook endpoint with signature verification OR manual admin status-update
- Pickup fee paid by seller (deduct from payout)
**Fix**: Create `backend/app/services/logistics_adapter.py` with interface and mock. Add shipment webhook endpoint.

### G8 — Order state machine mismatch
Spec states: `pending_payment→paid(escrow)→processing→pre_transit→in_transit→delivered→confirmed→paid_out`
Implemented: `pending→paid→shipped→completed→(cancelled, refunded as terminal)`
Missing states: `processing`, `pre_transit`, `in_transit`, `delivered`, `confirmed`, `paid_out`
The existing states roughly map to: `pending` ≈ `pending_payment`, `paid` ≈ `paid(escrow)`, `shipped` covers `processing+pre_transit+in_transit`, `completed` covers `delivered+confirmed+paid_out`.
**Assumption**: For Phase 2, I will rename states to match spec and add the missing granularity while keeping backward compat.

### G13 — Sensitive fields unencrypted
`government_id_number`, `payout_info` (JSON with account numbers), `id_front_url`, `id_back_url`, `selfie_url` stored as plain text in DB. Spec requires encryption at rest.
**Fix**: Add Fernet symmetric encryption via a `FIELD_ENCRYPTION_KEY` env var. Encrypt/decrypt in model property or service layer.

### G15 — Critical: `_serialize_profile` strips valid statuses
`_serialize_profile` in `backend/app/services/auth.py` coerces any status not in `{"buyer","pending","active","suspended","removed"}` to `"buyer"`. This means:
- `pending_verification` → becomes `"buyer"` in frontend
- `verified` → becomes `"buyer"` in frontend  
- `rejected` → becomes `"buyer"` in frontend
- `incomplete` → becomes `"buyer"` in frontend
This is a critical bug that breaks the entire verification state machine display.
**Fix**: Update the valid status set to include all defined statuses.

### G17 — Seller contact info leaked
`SellerSummaryOut` returns `email`, `phone`, `sellerContact.businessEmail`, `sellerContact.businessPhone`, `sellerContact.whatsapp` to any public caller. Spec: guests never see seller contact info, buyers cannot contact sellers directly.
**Fix**: Remove `email`, `phone`, `sellerContact.businessEmail/Phone/whatsapp` from `SellerSummaryOut`. Keep only display-safe fields.

### G29 — Payout idempotency missing
`confirm_delivery` calls `paystack_svc.initiate_transfer` without an idempotency key. If the HTTP request to Paystack fails partway and is retried, a duplicate transfer could occur.
**Fix**: Generate a stable idempotency key (e.g. `f"payout-{order.id}-{seller_id}"`) and pass to Paystack transfer API.

### G33 — Live secrets committed to tracked files
`.env.local` and `backend/.env` contain live Paystack keys (`sk_live_...`), DB passwords, and Supabase service role keys. These should never be committed.
**Assumption**: Cannot delete git history here. Will add both files to `.gitignore` and rotate secrets advisory. Will audit `.env.example` to ensure all needed vars are listed.

### G36 — Payout calculation missing pickup fee
Current payout = `listed_price / (1 + commission_rate)` per item. Processing fee (buyer-side) is charged to the buyer only. But the pickup fee (logistics cost to seller) is not deducted from seller payout because logistics isn't implemented.
**Assumption**: Until logistics is implemented, pickup fee deduction is not possible. Will document in gaps.

### G38 — Missing buyer welcome notification
`register_user` does not send a welcome notification. Spec requires "registration welcome" email for buyers.
**Fix**: Add `notify_safe` call in `register_user` for `event_type="welcome"`.

---

## Assumptions (to be flagged explicitly)

1. **Auto-release window**: Defaulting to 7 days after `delivered` status as spec states. This is configurable via `AUTO_RELEASE_DAYS` env var.
2. **Pickup fee handling**: Cannot implement until logistics adapter is built. Will stub as `0` for now.
3. **NIA API**: No actual NIA API credentials exist. Mock mode will be default. Real mode triggered by `NIA_API_URL` + `NIA_API_KEY` env vars.
4. **Face match**: No real face-match service. Mock mode returns score=0.95 pass. Real mode triggered by `FACE_MATCH_API_URL` + `FACE_MATCH_API_KEY`.
5. **Order state machine**: Will add new states to match spec without breaking existing data. Old `shipped`=`in_transit`, `completed`=`confirmed`.
6. **"Card" payout method**: Spec says "card OR MoMo" for payout. Currently the payout system works via Paystack bank-transfer API (recipient codes). Treating this as Paystack card-on-file rather than a separate field. The `card` payout method stores last-4 as reference info only.
7. **Seller contact info**: Business email and phone are business-public info in some contexts (store page). Ambiguous. Will remove from public SellerSummaryOut but note the assumption.

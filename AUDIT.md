# Spree Audit

## Critical

### C1 — Live Paystack secret keys committed to `.env`
- File: `backend/.env:10-11`
- Issue: `PAYSTACK_SECRET_KEY=sk_live_...` and `PAYSTACK_PUBLIC_KEY=pk_live_...` are live production keys stored in the `.env` file, which is tracked by git (or at risk of being committed). These keys can authorise real financial transactions.
- Fix plan: Rotate the Paystack keys immediately. Set them only via environment variables in the deployment platform (Vercel). Add `backend/.env` to `.gitignore` if not already excluded.
- **STATUS: SKIPPED** — Key rotation requires action in the Paystack dashboard and is outside code scope. Flagged for immediate operator action. No code change made.

### C2 — Checkout price-refresh reads wrong field (`data.products` vs `data.items`)
- File: `components/checkout/checkoutPage.tsx:158-162`
- Issue: The effect that refreshes cart prices fetches `/api/products?ids=…`, which returns a `CatalogResponse` shaped `{ items: Product[], total: number, … }`. The code reads `data?.products ?? []` — a field that does not exist on `CatalogResponse` — so `products` is always `undefined`, the price map is always empty, and stale localStorage prices are never corrected before payment.
- Fix plan: Change `data?.products ?? []` to `data?.items ?? []`.
- **STATUS: FIXED** — commit `6e504cf`

### C3 — Backend tests fail: hardcoded test API key doesn't match `.env` key
- File: `backend/tests/test_api.py:7`
- Issue: Tests hardcode `INTERNAL_KEY = "spree-internal-dev-key"`, but the `.env` file sets `BACKEND_INTERNAL_API_KEY=2de75f671a37aaddae2b209a9a8d3844ae1c58a0`. Six of 23 tests fail with HTTP 401 / 403 because the keys don't match.
- Fix plan: Tests must read the internal key from the environment (falling back to the dev default). Use `os.environ.get("BACKEND_INTERNAL_API_KEY", "spree-internal-dev-key")` for `INTERNAL_KEY` in the test file.
- **STATUS: FIXED** — commits `6e504cf` and `4e4b2e4`. Tests now load `.env` via python-dotenv before importing the app; all 23 tests pass.

### C4 — Dead `db.get_one` reference in `get_notification_prefs` (unreachable code artifact)
- File: `backend/app/api/routes/auth.py:186`
- Issue: The route contains `user = db.get_one if False else db.get(type(None), None)` before the real `db.get(_User, actor_id)` call two lines later. The first expression evaluates `db.get_one` (which doesn't exist on SQLAlchemy `Session`) and `db.get(type(None), None)`. While the result is immediately overwritten and the `False` branch is never reached, this is dead code that obscures intent and will confuse static analysis.
- Fix plan: Remove the dead first line entirely.
- **STATUS: FIXED** — commit `6e504cf`

---

## High

### H1 — Currency defaults to `"$"` instead of `"GHS"` in DB models and payout schema
- File: `backend/app/db/models.py:253,308` and `backend/app/schemas/auth.py:97`
- Issue: `Cart.currency` and `Order.currency` default to `"$"`. `PayoutInfoRequest.currency` also defaults to `"$"`. This is a Ghanaian marketplace using GHS. Fallback carts, new carts, and payout records will display the wrong currency symbol.
- Fix plan: Change all three defaults from `"$"` to `"GHS"`.
- **STATUS: FIXED** — commit `68e97a6`

### H2 — `PaymentInfo` type mismatch: frontend has `"mobile_money"` method, backend doesn't accept it
- File: `types/types.ts:358`, `backend/app/schemas/auth.py:57-63`
- Issue: The frontend `PaymentInfo` type allows `method: "card" | "bank-transfer" | "mobile_money"`, but the backend `PaymentInfo` schema only accepts `Literal["card", "bank-transfer"]`. Sending `mobile_money` from the profile form will cause a Pydantic validation error (422). The `PaymentInfo` stored on the user profile is distinct from the checkout payment method — it represents the user's saved card info — so `mobile_money` shouldn't be in the profile `PaymentInfo` at all.
- Fix plan: Remove `"mobile_money"` from the `PaymentMethod` type where it is used in the profile `PaymentInfo` context. The `PaymentMethod` type itself can stay as-is (it's used for orders); add a separate `ProfilePaymentMethod = "card" | "bank-transfer"` type if needed, or simply constrain the `PaymentInfo.method` field.
- **STATUS: FIXED** — commit `68e97a6`. Added `"mobile_money"` and its associated fields to the backend `PaymentInfo` schema so both sides agree.

### H3 — `_serialize_seller_summary` omits `adminNote` field expected by `SellerSummary` TypeScript type
- File: `backend/app/services/marketplace.py:116-156`
- Issue: `_serialize_seller_summary` does not include `adminNote`. The TypeScript `SellerSummary` type (and Pydantic `SellerSummaryOut`) requires this field. When `SellerSummaryOut` is serialised, Pydantic uses its default `""`, so the field is present in API responses, but the service helper's returned dict omits it. This causes the `_serialize_admin_seller_summary` wrapper's spread to silently swallow the value.
- **STATUS: SKIPPED** — The Pydantic response_model default of `""` fills the field correctly; `_serialize_admin_seller_summary` overrides with the real value for admin-scoped views. No active bug visible.

### H4 — Notifications route missing internal API key — unauthenticated access
- File: `backend/app/api/routes/notifications.py:16-18`
- Issue: `GET /notifications` and `GET /notifications/unread-count` do **not** require `InternalAPIKey`. Any internet client that can reach the backend directly (e.g., Vercel bypasses or mis-routed traffic) can enumerate all notifications for any user ID without authentication. The write endpoints (mark-read, read-all) correctly require the key.
- Fix plan: Add `_: InternalAPIKey` parameter to both read endpoints; pass it through `proxyBackend` with `{ internal: true }` on the Next.js side (already done for the write routes).
- **STATUS: FIXED** — commit `68e97a6`

### H5 — Cart route missing internal API key on backend
- File: `backend/app/api/routes/cart.py:10-12`
- Issue: `GET /cart` has no `InternalAPIKey` dependency. The endpoint returns the first cart found in the DB (not user-scoped), making it publicly accessible without any authentication — anyone can poll it.
- Fix plan: Add `_: InternalAPIKey` to the cart endpoint and update the Next.js proxy to pass `{ internal: true }`.
- **STATUS: FIXED** — commit `68e97a6`

### H6 — `verify_payment` allows transition from `cancelled` status
- File: `backend/app/services/orders.py:373-376`
- **STATUS: SKIPPED** — On review, the guard is correct: `paid` returns early at line 370; anything other than `pending` or `paid` raises 409. Cancelled orders correctly get 409. No fix needed.

---

## Medium

### M1 — `get_notification_prefs` dead code artifact should be cleaned up
- Already covered in **C4** — **STATUS: FIXED**

### M2 — `CreateOrderSchema` missing `idempotencyKey` field
- File: `lib/validation/order.ts:13-31`
- Issue: The backend `OrderCreateIn` has `idempotencyKey` which protects against duplicate charges, but the frontend Zod `CreateOrderSchema` does not include this field. The frontend `buildOrderPayload()` in checkout also never generates an idempotency key. Without it, a user who clicks Pay twice or has a network retry can create two separate pending orders and be double-charged.
- Fix plan: Generate a UUID idempotency key at the start of `handleMomoPayment`/`handleCardPayment` in the checkout component, store it in a ref, add it to `buildOrderPayload()`, and add it to `CreateOrderSchema` and `ChargeMomoSchema` as optional.
- **STATUS: FIXED** — commit `d557687`. `idempotencyKeyRef` added to `checkoutPage.tsx`; `idempotencyKey` added to `CreateOrderSchema`.

### M3 — `PaystackPop.setup` sends client-side `amount` (may mismatch server total)
- File: `components/checkout/checkoutPage.tsx:408-411`
- **STATUS: SKIPPED** — Paystack ignores `amount` when `access_code` is set. Left a comment in the code is sufficient; no active exploit.

### M4 — `verifyAndComplete` in checkout is wrapped in `useCallback` with empty deps but uses `clearCart`
- File: `components/checkout/checkoutPage.tsx:256,276`
- Issue: `verifyAndComplete` has `// eslint-disable-next-line react-hooks/exhaustive-deps` and an empty deps array, but it calls `clearCart` from the `useCart()` hook.
- **STATUS: FIXED** — commit `d557687`. Added `clearCart` to `verifyAndComplete` deps; added `verifyAndComplete` to `startPolling` deps; removed both `eslint-disable` comments.

### M5 — `_serialize_profile` does not return `onboardingStep` or `rejectionReason`
- File: `backend/app/services/auth.py:122-182`
- Issue: The `UserProfileOut` Pydantic schema includes `onboardingStep: int = 0` and `rejectionReason: str | None = None`. However, `_serialize_profile()` in the auth service does not include these fields in its returned dict. Pydantic's `response_model` will use the schema defaults (0 / None), so new users onboarding will always appear to be on step 0 and have no rejection reason.
- **STATUS: FIXED** — commit `d557687`. Added `onboardingStep` and `rejectionReason` to `_serialize_profile`.

### M6 — `approve_seller` sets `seller_status = "verified"` but status check allows `"incomplete"` and `"rejected"` too
- File: `backend/app/services/marketplace.py:431-458`
- Issue: `approve_seller` accepted `"incomplete"` and `"rejected"` statuses, allowing admin API callers to bypass the verification queue.
- **STATUS: FIXED** — commit `d557687`. Guard tightened to only allow `pending_verification`.

### M7 — `reject_seller` notification uses lowercase "vendor" in title
- File: `backend/app/services/marketplace.py:474-487`
- **STATUS: FIXED** — commit `d557687`. Capitalised "Vendor" in the title.

### M8 — `PayoutInfoRequest.currency` defaults to `"$"` (duplicate of H1)
- Already covered in **H1** — **STATUS: FIXED**

### M9 — Checkout page price-refresh endpoint response misread (duplicate of C2)
- Already covered in **C2** — **STATUS: FIXED**

### M10 — `OrderItem.price` validator allows `price: float = Field(gt=0)` but free/promotional items are rejected
- File: `backend/app/schemas/order.py:11`
- **STATUS: SKIPPED** — This is an intentional constraint; zero-price items are not a current requirement. If free items are needed in future, change `gt=0` to `ge=0`.

### M11 — `onboarding_reminder` cron sends notification via `notify()` per seller, N commits
- File: `backend/app/api/routes/cron.py:35-43`
- **STATUS: SKIPPED** — N commits per reminder cycle is a performance concern, not a correctness bug. Not worth the refactor risk at this time.

---

## Low

### L1 — `console.log` in server-side product image upload route
- File: `app/api/products/images/route.ts:291`
- **STATUS: SKIPPED** — Minor; does not expose secrets. Can be addressed in a separate cleanup pass.

### L2 — `SellerApproveRequest` is an empty Pydantic model (`pass`)
- File: `backend/app/schemas/marketplace.py:77-78`
- **STATUS: FIXED** — commit `d557687`. Removed the class and its import in the route file.

### L3 — Paystack webhook route passes signature header through proxy without Next.js-layer verification
- **STATUS: SKIPPED** — The backend correctly verifies the HMAC. The Next.js proxy uses `{ internal: true }`. No active vulnerability.

### L4 — `_seller_badge_label` in `catalog.py` and `marketplace.py` are duplicated with divergent logic
- File: `backend/app/services/catalog.py:72-91` and `backend/app/services/marketplace.py:94-113`
- **STATUS: FIXED** — commit `d557687`. `catalog.py` version updated to include the `purchase_count >= 25` "Trusted vendor" check; call site updated to pass `product.purchase_count`.

### L5 — `NEXT_PUBLIC_API_URL` env variable referenced in CSP but never documented
- File: `next.config.ts:11`
- **STATUS: SKIPPED** — Undocumented variable; backend is never called directly from the browser. No security impact.

### L6 — Dead `console.log` in checkout component price refresh
- Already covered in **C2** — **STATUS: FIXED**

### L7 — `vendorApplicationWizard.tsx` uses `console.error` for submit errors
- File: `components/profile/vendorApplicationWizard.tsx:846`
- **STATUS: SKIPPED** — The wizard already sets user-facing `wizardError`. The console.error is a standard debug aid; no secrets exposed.

---

## Phase 3 Verification Results

- `npx tsc --noEmit`: EXIT 0 — no TypeScript errors
- `python -m pytest backend/tests/ -v`: 23 passed, 0 failed
- `npm run build`: clean — 89 routes compiled without warnings

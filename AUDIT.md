# Spree Audit

## Critical

### C1 — Live Paystack secret keys committed to `.env`
- File: `backend/.env:10-11`
- Issue: `PAYSTACK_SECRET_KEY=sk_live_...` and `PAYSTACK_PUBLIC_KEY=pk_live_...` are live production keys stored in the `.env` file, which is tracked by git (or at risk of being committed). These keys can authorise real financial transactions.
- Fix plan: Rotate the Paystack keys immediately. Set them only via environment variables in the deployment platform (Vercel). Add `backend/.env` to `.gitignore` if not already excluded.

### C2 — Checkout price-refresh reads wrong field (`data.products` vs `data.items`)
- File: `components/checkout/checkoutPage.tsx:158-162`
- Issue: The effect that refreshes cart prices fetches `/api/products?ids=…`, which returns a `CatalogResponse` shaped `{ items: Product[], total: number, … }`. The code reads `data?.products ?? []` — a field that does not exist on `CatalogResponse` — so `products` is always `undefined`, the price map is always empty, and stale localStorage prices are never corrected before payment.
- Fix plan: Change `data?.products ?? []` to `data?.items ?? []`.

### C3 — Backend tests fail: hardcoded test API key doesn't match `.env` key
- File: `backend/tests/test_api.py:7`
- Issue: Tests hardcode `INTERNAL_KEY = "spree-internal-dev-key"`, but the `.env` file sets `BACKEND_INTERNAL_API_KEY=2de75f671a37aaddae2b209a9a8d3844ae1c58a0`. Six of 23 tests fail with HTTP 401 / 403 because the keys don't match.
- Fix plan: Tests must read the internal key from the environment (falling back to the dev default). Use `os.environ.get("BACKEND_INTERNAL_API_KEY", "spree-internal-dev-key")` for `INTERNAL_KEY` in the test file.

### C4 — Dead `db.get_one` reference in `get_notification_prefs` (unreachable code artifact)
- File: `backend/app/api/routes/auth.py:186`
- Issue: The route contains `user = db.get_one if False else db.get(type(None), None)` before the real `db.get(_User, actor_id)` call two lines later. The first expression evaluates `db.get_one` (which doesn't exist on SQLAlchemy `Session`) and `db.get(type(None), None)`. While the result is immediately overwritten and the `False` branch is never reached, this is dead code that obscures intent and will confuse static analysis.
- Fix plan: Remove the dead first line entirely.

---

## High

### H1 — Currency defaults to `"$"` instead of `"GHS"` in DB models and payout schema
- File: `backend/app/db/models.py:253,308` and `backend/app/schemas/auth.py:97`
- Issue: `Cart.currency` and `Order.currency` default to `"$"`. `PayoutInfoRequest.currency` also defaults to `"$"`. This is a Ghanaian marketplace using GHS. Fallback carts, new carts, and payout records will display the wrong currency symbol.
- Fix plan: Change all three defaults from `"$"` to `"GHS"`.

### H2 — `PaymentInfo` type mismatch: frontend has `"mobile_money"` method, backend doesn't accept it
- File: `types/types.ts:358`, `backend/app/schemas/auth.py:57-63`
- Issue: The frontend `PaymentInfo` type allows `method: "card" | "bank-transfer" | "mobile_money"`, but the backend `PaymentInfo` schema only accepts `Literal["card", "bank-transfer"]`. Sending `mobile_money` from the profile form will cause a Pydantic validation error (422). The `PaymentInfo` stored on the user profile is distinct from the checkout payment method — it represents the user's saved card info — so `mobile_money` shouldn't be in the profile `PaymentInfo` at all.
- Fix plan: Remove `"mobile_money"` from the `PaymentMethod` type where it is used in the profile `PaymentInfo` context. The `PaymentMethod` type itself can stay as-is (it's used for orders); add a separate `ProfilePaymentMethod = "card" | "bank-transfer"` type if needed, or simply constrain the `PaymentInfo.method` field.

### H3 — `_serialize_seller_summary` omits `adminNote` field expected by `SellerSummary` TypeScript type
- File: `backend/app/services/marketplace.py:116-156`
- Issue: `_serialize_seller_summary` does not include `adminNote`. The TypeScript `SellerSummary` type (and Pydantic `SellerSummaryOut`) requires this field. When `SellerSummaryOut` is serialised, Pydantic uses its default `""`, so the field is present in API responses, but the service helper's returned dict omits it. This causes the `_serialize_admin_seller_summary` wrapper's spread to silently swallow the value.
- Fix plan: Add `"adminNote": vendor.admin_note or ""` to `_serialize_seller_summary` in `marketplace.py`.

### H4 — Notifications route missing internal API key — unauthenticated access
- File: `backend/app/api/routes/notifications.py:16-18`
- Issue: `GET /notifications` and `GET /notifications/unread-count` do **not** require `InternalAPIKey`. Any internet client that can reach the backend directly (e.g., Vercel bypasses or mis-routed traffic) can enumerate all notifications for any user ID without authentication. The write endpoints (mark-read, read-all) correctly require the key.
- Fix plan: Add `_: InternalAPIKey` parameter to both read endpoints; pass it through `proxyBackend` with `{ internal: true }` on the Next.js side (already done for the write routes).

### H5 — Cart route missing internal API key on backend
- File: `backend/app/api/routes/cart.py:10-12`
- Issue: `GET /cart` has no `InternalAPIKey` dependency. The endpoint returns the first cart found in the DB (not user-scoped), making it publicly accessible without any authentication — anyone can poll it.
- Fix plan: Add `_: InternalAPIKey` to the cart endpoint and update the Next.js proxy to pass `{ internal: true }`.

### H6 — `verify_payment` allows transition from `cancelled` status
- File: `backend/app/services/orders.py:373-376`
- Issue: `verify_payment` checks `if order.status not in ("pending", "paid")` and raises 409, but because it checks `order.status == "paid"` and returns early before that guard, a `cancelled` order also reaches the guard correctly. However the guard `order.status not in ("pending", "paid")` does NOT raise for `"paid"` — it returns early. The logic is correct but confusing — actually looking at it again: if status is `paid`, we return early (line 370). If it's not `pending` or `paid`, we raise 409. So cancelled → 409. This is actually correct. Marking as informational only.
- **Status: INFORMATIONAL — no fix needed.**

---

## Medium

### M1 — `get_notification_prefs` dead code artifact should be cleaned up
- File: `backend/app/api/routes/auth.py:186-187`
- Issue: Same as C4 — the `user = db.get_one if False else db.get(type(None), None)` line is dead code that is confusing. (Already listed as C4.)

### M2 — `CreateOrderSchema` missing `idempotencyKey` field
- File: `lib/validation/order.ts:13-31`
- Issue: The backend `OrderCreateIn` has `idempotencyKey` which protects against duplicate charges, but the frontend Zod `CreateOrderSchema` does not include this field. The frontend `buildOrderPayload()` in checkout also never generates an idempotency key. Without it, a user who clicks Pay twice or has a network retry can create two separate pending orders and be double-charged.
- Fix plan: Generate a UUID idempotency key at the start of `handleMomoPayment`/`handleCardPayment` in the checkout component, store it in a ref, add it to `buildOrderPayload()`, and add it to `CreateOrderSchema` and `ChargeMomoSchema` as optional.

### M3 — `PaystackPop.setup` sends client-side `amount` (may mismatch server total)
- File: `components/checkout/checkoutPage.tsx:408-411`
- Issue: When using the Paystack inline popup (card payment with `accessCode`), the call passes `amount: Math.round(total * 100)` — the client-computed total. For the inline popup flow with `access_code`, Paystack ignores the `amount` and uses the server-initialised value, so this is not an active exploit. However, the code is misleading and should be cleaned up to avoid future confusion.
- Fix plan: Remove the `amount` field from `PaystackPop.setup` when `accessCode` is present (Paystack ignores it anyway), or leave a comment explaining why it's there.

### M4 — `verifyAndComplete` in checkout is wrapped in `useCallback` with empty deps but uses `clearCart`
- File: `components/checkout/checkoutPage.tsx:256,276`
- Issue: `verifyAndComplete` has `// eslint-disable-next-line react-hooks/exhaustive-deps` and an empty deps array, but it calls `clearCart` from the `useCart()` hook. If `clearCart` ever changes (e.g., provider refactor), the stale reference would silently fail. The `startPolling` `useCallback` also suppresses the rule.
- Fix plan: Add `clearCart` to the `verifyAndComplete` deps array, and `verifyAndComplete` to `startPolling`'s deps, removing the eslint-disable comments.

### M5 — `_serialize_profile` does not return `onboardingStep` or `rejectionReason`
- File: `backend/app/services/auth.py:122-182`
- Issue: The `UserProfileOut` Pydantic schema (in `auth.py`) includes `onboardingStep: int = 0` and `rejectionReason: str | None = None`. However, `_serialize_profile()` in the auth service does not include these fields in its returned dict. Pydantic's `response_model` will use the schema defaults (0 / None), so new users onboarding will always appear to be on step 0 and have no rejection reason — even mid-onboarding or after a rejection.
- Fix plan: Add `"onboardingStep": user.onboarding_step or 0` and `"rejectionReason": user.rejection_reason` to the `_serialize_profile` return dict.

### M6 — `approve_seller` sets `seller_status = "verified"` but status check allows `"incomplete"` and `"rejected"` too
- File: `backend/app/services/marketplace.py:431-458`
- Issue: `approve_seller` sets `vendor.seller_status = "verified"` but the TS `SellerStatus` type and the `SellerStatus` Python Literal do include `"verified"` as a valid value. The `list_verification_queue` only pulls `"pending_verification"` sellers, so an admin can only approve sellers whose status is `"pending_verification"`. The function body accepts `"incomplete"` and `"rejected"` but those are never surfaced in the verification queue. This is safe but inconsistent: the verification queue route should be the only entry point, and the function's accepted-states check is broader than needed.
- Fix plan: Add a check in `approve_seller` to only allow approving from `"pending_verification"` (or log a warning for the other cases). This prevents an admin API caller from bypassing the queue.

### M7 — `reject_seller` notification uses lowercase "vendor" in title
- File: `backend/app/services/marketplace.py:474-487`
- Issue: `title="vendor application not approved"` uses lowercase "vendor" in the notification title. Should be capitalised: "Vendor application not approved".
- Fix plan: Capitalise "Vendor" in the title string.

### M8 — `PayoutInfoRequest.currency` defaults to `"$"` (duplicate of H1)
- Already covered in **H1**.

### M9 — Checkout page price-refresh endpoint response misread (duplicate of C2)
- Already covered in **C2**.

### M10 — `OrderItem.price` validator allows `price: float = Field(gt=0)` but free/promotional items are rejected
- File: `backend/app/schemas/order.py:11`
- Issue: `OrderItemIn.price = Field(gt=0, le=999_999)` rejects price=0. This prevents promotional or free gift items in an order. The service already handles `productId=None` items accepting client prices. If free items are ever needed, this will block them.
- Fix plan: Change to `Field(ge=0, le=999_999)` to allow zero-price items.

### M11 — `onboarding_reminder` cron sends notification via `notify()` which commits inside the loop, then `notify()` commits again
- File: `backend/app/api/routes/cron.py:35-43` and `backend/app/services/notifications.py:191-195`
- Issue: The cron route iterates sellers and calls `notif_svc.notify()` per seller. `notify()` calls `db.commit()` at the end. This means N commits for N sellers, which is fine for correctness but is inefficient. If any commit fails mid-loop, some sellers are notified and some aren't with no rollback.
- Fix plan: Collect all notifications in a list, batch-add them, then commit once after the loop.

---

## Low

### L1 — `console.log` in server-side product image upload route
- File: `app/api/products/images/route.ts:291`
- Issue: `console.log(\`[product-images] converting ${sniffed.toUpperCase()} → JPEG for ${file.name}\`)` uses `console.log` instead of structured logging. In a production environment this leaks internal file names.
- Fix plan: Change to `console.info` or remove entirely.

### L2 — `SellerApproveRequest` is an empty Pydantic model (`pass`)
- File: `backend/app/schemas/marketplace.py:77-78`
- Issue: `class SellerApproveRequest(BaseModel): pass` — defined but never used in the approve route (the route takes no body). This dead schema adds confusion.
- Fix plan: Remove the class or use it if the approve endpoint ever needs a reason field.

### L3 — Paystack webhook route passes signature header through the Next.js proxy without verifying it
- File: `app/api/webhooks/paystack/route.ts`
- Issue: The Next.js webhook route passes the raw body and `x-paystack-signature` directly to the backend without any validation at the Next.js layer. This is fine architecturally (the backend verifies), but it means the webhook endpoint is reachable without `BACKEND_INTERNAL_API_KEY` verification — the route calls `proxyBackend(..., { internal: true })` which will add the key, so this is actually correct. **No fix needed.**

### L4 — `_seller_badge_label` in `catalog.py` and `marketplace.py` are duplicated
- File: `backend/app/services/catalog.py:72-91` and `backend/app/services/marketplace.py:94-113`
- Issue: Two functions named `_seller_badge_label` exist with slightly different logic (the marketplace version also checks `purchase_count >= 25`). This divergence may cause inconsistent badge display between the product listing and the seller profile page.
- Fix plan: Consolidate into one function in a shared module (or `catalog.py`) and import it in `marketplace.py`.

### L5 — `NEXT_PUBLIC_API_URL` env variable is referenced in `next.config.ts` CSP but never documented
- File: `next.config.ts:11`
- Issue: `const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? ""` is used in the CSP `connect-src` directive. This variable is not documented in `README.md`'s environment variable table and not referenced anywhere else in the codebase.
- Fix plan: Add to the README env table, or remove the reference if the backend is never accessed directly from the browser (which appears to be the case — all requests go through Next.js route handlers).

### L6 — Dead `console.log` in checkout component price refresh
- Already covered in C2 (the fetch itself is broken, so the log never fires anyway).

### L7 — `vendorApplicationWizard.tsx` uses `console.error` for submit errors
- File: `components/profile/vendorApplicationWizard.tsx:846`
- Issue: `console.error("[VendorApplicationWizard] submit error:", err)` leaks error details to the browser console in production. Should use structured server logging or be removed.
- Fix plan: Remove or replace with a user-facing error state (the wizard already sets `wizardError` from the err message).

# Production data migration runbook

Seven one-off scripts in `backend/scripts/` fix data drift confirmed live on
spreecommerce.vercel.app (2026-08-17): stock/variant disagreement, orphaned
variant images, non-canonical colors/sizes, products sitting at the main
category instead of a subcategory, a collection typo, and missing seller
store identity.

**Every script defaults to dry-run.** A bare invocation only prints a
before/after table and changes nothing. Pass `--apply` to actually write.
`--dry-run` is also accepted explicitly (it's the default either way — there
is no flag combination that writes without `--apply`).

This runbook assumes you have production `DATABASE_URL` (the Supabase
Postgres non-pooling connection string) and are comfortable running Python
scripts against it directly. **Nothing in this repo can run these for
you** — they need to be executed by someone with that access.

## Prerequisites

```bash
cd backend
export DATABASE_URL="<production non-pooling Postgres URL>"
# Verify you're actually pointed at production, not local dev, before doing
# anything else:
python3 -c "from app.core.config import settings; print(settings.database_url)"
```

No other env vars are required — these scripts talk to the database
directly via SQLAlchemy, not through the API, so `BACKEND_INTERNAL_API_KEY`
etc. don't apply here.

**Take a full logical backup before starting** (independent of the
per-script snapshots below): `pg_dump` the database, or use Supabase's own
point-in-time-recovery/backup feature if enabled. The per-script snapshot
queries in this runbook are fast, targeted rollback paths for one script at
a time — they are not a substitute for a real backup of the whole database.

## Step 0 — Pre-flight check

```bash
python3 scripts/verify_data_integrity.py
```

Read-only. Reports current drift across all seven categories in one pass —
this is what "confirmed live" in the summary above was reconstructed from.
Run this first so you have a concrete before-picture, and keep the output —
you'll diff it against the Step 8 run.

## Order, and why

| # | Script | Risk if skipped/delayed |
|---|---|---|
| 1 | `reconcile_product_stock.py` | **Highest** — a drifted `product.stock` is what the checkout stock-availability check (`_check_stock`) reads; leaving it too low blocks real sales, too high oversells. Fix this before anything else touches these rows. |
| 2 | `fix_orphaned_variant_images.py` | Cosmetic (wrong image shown for a variant) but touches the same `variants` JSON column as steps 3–4 — doing it before color/size normalization means each script's diff is about only its own concern, easier to review. |
| 3 | `normalize_variant_colors.py` | Independent of size normalization; order between 3 and 4 doesn't matter (different sub-fields of the same variant dicts), kept in the requested order. |
| 4 | `normalize_variant_sizes.py` | Same as above. |
| 5 | `normalize_product_subcategories.py` | Reassigns `category_id` — independent of the `variants` column steps 1–4 touch, but run after them so a `--dry-run` diff of this step isn't also showing unrelated variant-JSON noise if you're reviewing column-level diffs. |
| 6 | `fix_collection_typos.py` | Renames a collection slug — **do not run until the redirect below is confirmed live**, since the rename is what makes the redirect start mattering. |
| 7 | `backfill_seller_store_identity.py` | Lowest risk (additive — only fills NULL columns, never overwrites). Last because it's the least urgent: nothing else depends on it, and it's the easiest to verify visually (`/seller/<slug>` resolving) once everything else is settled. |

This matches the requested order — no reordering needed. The one hard
dependency is step 6 on the redirect check immediately below it.

## Before step 6: confirm the redirect is live

```bash
curl -sI "https://spreecommerce.vercel.app/products?collection=phone-accesories" | head -1
# Expect: HTTP/2 308, with a location header pointing at ?collection=phone-accessories
```

This redirect (`next.config.ts`, matched on the `collection` query param)
was verified live and returns `308` to `?collection=phone-accessories`
already — confirm it's still there before running step 6's `--apply`, since
that's what keeps existing shared `?collection=phone-accesories` links
working after the slug changes underneath them.

---

## Step 1 — Stock reconciliation

```bash
python3 scripts/reconcile_product_stock.py              # dry-run — review the table
python3 scripts/reconcile_product_stock.py --apply       # writes
```

**Changes:** `products.stock` only (never `variants`) — sets it to
`sum(variant.stock)` for every product where they disagree.

**Expected** (from the 2026-08-17 report): 2 rows —
`usb-c-cable-and-plug` (82 → 95), `apple-macbook-pro` (7 → 10). The other
three named products (iphone17promax, iphone-17-air, magsafe-charger) were
already consistent and should show 0 rows. Confirm the actual count from
your own dry-run output — don't assume these are still the only two drifted
rows by the time you run this.

**Backup/rollback:**
```sql
-- Snapshot before running:
CREATE TABLE products_stock_backup_YYYYMMDD AS
SELECT id, stock FROM products;

-- Rollback if needed:
UPDATE products p SET stock = b.stock
FROM products_stock_backup_YYYYMMDD b
WHERE p.id = b.id;
```

**Verify:**
```bash
curl -s "https://spreecommerce.vercel.app/api/products?limit=48" | python3 -c "
import json, sys
for p in json.load(sys.stdin)['items']:
    print(p['id'], p['stock'])
"
```
Cross-check against `sum(variant['stock'] for variant in variants)` per
product — should always match now. `test_product_stock_always_equals_sum_of_variant_stock`
(backend/tests/test_api.py) is the code-level version of this same check.

---

## Step 2 — Orphaned variant images

```bash
python3 scripts/fix_orphaned_variant_images.py
python3 scripts/fix_orphaned_variant_images.py --apply
```

**Changes:** `products.variants[].image` — repoints any image URL not
present in that product's own `images[]` to `images[0]` (the lead image).
Never touches `images[]` itself.

**Expected:** at least `iphone-17-air` (variants reference an image
`67b37245…` absent from its gallery) and `apple-macbook-pro` (variants
reference a `.jpg`, gallery holds only `.png`s) — one row per affected
variant, so if either product has multiple variants sharing the bad image,
expect multiple rows for that one product. Confirm the exact count from the
dry-run table.

**Backup/rollback:**
```sql
CREATE TABLE products_variants_backup_YYYYMMDD AS
SELECT id, variants FROM products;

-- Rollback: restore the whole variants column (JSON) per product.
UPDATE products p SET variants = b.variants
FROM products_variants_backup_YYYYMMDD b
WHERE p.id = b.id;
```
(This snapshot covers steps 2–4 together, since they all touch `variants` —
one snapshot before step 2, one rollback path if any of 2/3/4 need undoing.)

**Verify:** for each product, every `variants[].image` should appear in
that product's own `images[]`:
```bash
curl -s "https://spreecommerce.vercel.app/api/products/iphone-17-air" | python3 -c "
import json, sys
p = json.load(sys.stdin)
bad = [v for v in p['variants'] if v['image'] not in p['images']]
print('orphaned:', bad or 'none')
"
```

---

## Step 3 — Color normalization

```bash
python3 scripts/normalize_variant_colors.py
python3 scripts/normalize_variant_colors.py --apply
```

**Changes:** `products.variants[].color` — maps to the canonical 24-value
list (`app/core/color_taxonomy.py`) via exact match, case-insensitive
match, or a short hand-picked synonym table (`Navy blue`→`Navy`,
`Ash`→`Gray`, `Light grey`/`Light gray`/`Grey`/`Dark grey`/`Charcoal`→`Gray`,
etc.). Anything it can't confidently map is flagged NEEDS_REVIEW and left
untouched — check the dry-run output's "Flagged for manual review" section
for those.

**Expected:** every reported non-canonical value (`Navy blue`, `Ash`,
`Light grey`, `Dark Grey`) is covered by the synonym table above and should
resolve automatically — confirm none of them land in the flagged section.

**Backup/rollback:** covered by the same `products_variants_backup_YYYYMMDD`
snapshot as step 2 (take it once, before step 2, if running the whole
sequence in order).

**Verify:**
```bash
curl -s "https://spreecommerce.vercel.app/api/products?limit=48" | python3 -c "
import json, sys
CANON = {'Black','White','Gray','Silver','Gold','Red','Maroon','Pink','Orange','Yellow','Green','Olive','Teal','Turquoise','Blue','Navy','Purple','Lavender','Brown','Beige','Cream','Sand','Multicolor','Ankara Print','Kente Print'}
for p in json.load(sys.stdin)['items']:
    bad = [v['color'] for v in p['variants'] if v.get('color') and v['color'] not in CANON]
    if bad: print(p['id'], bad)
"
```
No output = clean.

---

## Step 4 — Size normalization

```bash
python3 scripts/normalize_variant_sizes.py
python3 scripts/normalize_variant_sizes.py --apply
```

**Changes:** `products.variants[].size` — reformats clean
`<number><unit>` values (e.g. `20cm` → `20 cm`), snaps values with a
trailing qualifier (e.g. `6.15" height`) to the nearest same-unit preset if
it's within a sane relative distance, and flags anything implausible or
unparseable as NEEDS_REVIEW rather than guessing.

**Expected:** `usb-c-cable-and-plug`'s `20cm`/`30cm` reformat cleanly (no
trailing text, straightforward). `iphone-17-air`'s `6.15" height` should
snap to the nearest Screen size preset. `magsafe-charger`'s `30"` and
`iphone17promax`'s `18"` are the ones to look at closely in the dry-run
output — a `30"` charger and an `18"` phone are both far outside any
plausible Screen-size range, so `normalize_one`'s implausibility check
(±50%/150% of the same-unit preset range) will very likely flag both
NEEDS_REVIEW rather than silently reformat them. **That's expected
behavior, not a bug in the script** — those two values need a human to
decide the real size (this script deliberately won't guess a phone screen
is actually `6.1"` just because that's a common preset). Check the
"Flagged for manual review" table and fix those two by hand (a direct
`UPDATE` or through the vendor edit form, which enforces the canonical set
on write).

**Backup/rollback:** same `products_variants_backup_YYYYMMDD` snapshot as
steps 2–3.

**Verify:**
```bash
curl -s "https://spreecommerce.vercel.app/api/products?limit=48" | python3 -c "
import json, sys
for p in json.load(sys.stdin)['items']:
    print(p['id'], p['sizes'])
"
```
Manually confirm nothing implausible remains (a phone at 30\", etc.) — this
step alone won't fully clean magsafe-charger/iphone17promax; see above.

---

## Step 5 — Subcategory assignment (populates categoryParent)

```bash
python3 scripts/normalize_product_subcategories.py
python3 scripts/normalize_product_subcategories.py --apply
```

**Changes:** `products.category_id` — moves a product from a main category
into a matching subcategory via a curated keyword table (e.g. "iphone" →
Smartphones, "macbook" → Computers & Tablets). Zero or multiple keyword
matches are flagged NEEDS_REVIEW and left at the main category.

**Expected:** all 5 known products should match cleanly — iPhone 17 Pro
Max/iPhone 17 Air → Smartphones, Magsafe Wireless Charger/USB-C charger →
Chargers & Cables (via "charger"), MacBook Pro M5 2025 → Computers &
Tablets (via "macbook"). If any of the 5 shows up in the flagged table
instead, the product name doesn't contain the expected keyword — check
`KEYWORDS_BY_SUBCATEGORY` in the script and either add a keyword or
reassign that one manually.

**Backup/rollback:**
```sql
CREATE TABLE products_category_backup_YYYYMMDD AS
SELECT id, category_id FROM products;

UPDATE products p SET category_id = b.category_id
FROM products_category_backup_YYYYMMDD b
WHERE p.id = b.id;
```

**Verify:**
```bash
curl -s "https://spreecommerce.vercel.app/api/products?limit=48" | python3 -c "
import json, sys
for p in json.load(sys.stdin)['items']:
    print(p['id'], p['category'], '<-', p.get('categoryParent'))
"
```
`categoryParent` should now be populated (e.g. `Smartphones <- Phones & Accessories`)
instead of `None` for all 5.

---

## Step 6 — Collection typo fix

**Confirm the redirect check above passed before running `--apply` here.**

```bash
python3 scripts/fix_collection_typos.py
python3 scripts/fix_collection_typos.py --apply
```

**Changes:** the `phone-accesories` collection's `name`/`slug` →
`Phone Accessories`/`phone-accessories`; sweeps every collection's
`description` for `"fro iPhone and android devices"` → `"for iPhone and
Android devices"` and any stray `"---"`.

**Expected:** 1 row for the name/slug rename, plus 1 row for the
description fix (both on the same collection, if the typo'd description is
on the `phone-accesories` collection itself, which is what was reported) —
2 rows total. Confirm from the dry-run table; a different row count just
means the description issue was on a different collection than expected,
not that the script is wrong.

**Backup/rollback:**
```sql
CREATE TABLE collections_backup_YYYYMMDD AS
SELECT id, name, slug, description FROM collections;

UPDATE collections c SET name = b.name, slug = b.slug, description = b.description
FROM collections_backup_YYYYMMDD b
WHERE c.id = b.id;
```
If you roll this back, the redirect (`?collection=phone-accesories` →
`?collection=phone-accessories`) is harmless to leave in place either way —
it simply won't be exercised until the rename is re-applied.

**Verify:**
```bash
curl -s "https://spreecommerce.vercel.app/api/collections" | python3 -c "
import json, sys
for c in json.load(sys.stdin):
    print(c['name'], '|', c['slug'], '|', c['description'])
"
```
No more "accesories"/"fro iPhone" anywhere in the output.

---

## Step 7 — Seller store identity backfill

```bash
python3 scripts/backfill_seller_store_identity.py
python3 scripts/backfill_seller_store_identity.py --apply
```

**Changes:** `users.store_name`/`users.store_slug` — only for
vendor/admin-role accounts where `store_name IS NULL`. Never overwrites an
existing value a vendor set via onboarding.

**Expected:** 1 row — the seed admin account (`user-admin`), since all 5
live products are currently owned by it. `store_name` derives from the
account's display name (e.g. "Spree Admin"), `store_slug` from slugifying
that ("spree-admin"), with a numeric suffix on collision (there shouldn't
be one for a single-row backfill).

**Backup/rollback:**
```sql
CREATE TABLE users_store_identity_backup_YYYYMMDD AS
SELECT id, store_name, store_slug FROM users WHERE store_name IS NOT NULL;
-- (run BEFORE step 7, so it only captures pre-existing values, not the ones this step is about to add)

-- Rollback: null out only the rows this script added (i.e. rows absent
-- from the backup table entirely, since it only ever fills NULLs):
UPDATE users SET store_name = NULL, store_slug = NULL
WHERE id NOT IN (SELECT id FROM users_store_identity_backup_YYYYMMDD)
  AND role IN ('vendor', 'admin');
```

**Verify:**
```bash
curl -s "https://spreecommerce.vercel.app/api/products?limit=1" | python3 -c "
import json, sys
p = json.load(sys.stdin)['items'][0]
print(p['storeName'], p['storeSlug'])
"
curl -sI "https://spreecommerce.vercel.app/seller/spree-admin" | head -1   # expect 200, not 404
```

---

## Step 8 — Post-flight check

```bash
python3 scripts/verify_data_integrity.py
```

Diff this against the Step 0 output — every check should now read `CLEAN`
(0 issues). Anything still non-zero is either a NEEDS_REVIEW item the
scripts deliberately didn't touch (see steps 3–5's notes above) or
something worth investigating before considering this done.

## Regression checks (run once everything above is applied)

- `/api/products` still has no `sellerPrice` or `isBlacklisted` on any item
  (these migrations don't touch that code path, but worth reconfirming
  after any prod deploy/migration window).
- Homepage "Fresh arrivals" still lists the newest product first.
- `/dashboard` price chips still read "Your payout" / "Buyer pays".
- `/products` category filter chip sequence (All → a category → All →
  another category → All) still keeps chip, URL, and list in agreement —
  step 5 changes `category_id` on 5 products, which is the one step here
  with any plausible interaction with filtering/counts.
- `curl -I` on `/`, `/products`, `/cart`, `/orders` still 200.

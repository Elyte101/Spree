-- RLS policies for Spree — run once in the Supabase SQL Editor (or via psql).
-- Idempotent: safe to re-run. Last updated: 2026-07-14.
--
-- Architecture note
-- -----------------
-- The FastAPI backend connects as service_role (DATABASE_SUPABASE_SERVICE_ROLE_KEY).
-- service_role bypasses RLS entirely, so these policies only affect direct
-- PostgREST / Supabase client access.  The frontend NEVER queries Supabase
-- directly — all DB access goes through the backend API. Every policy below
-- is defense-in-depth against someone hitting PostgREST directly with the
-- anon/authenticated key (or Supabase's dashboard "public" API) — the app
-- itself never relies on any of these policies for normal operation.
--
-- 2026-07-14: extended from the original 2 tables (promo_banners,
-- identity_sessions) to cover every table in the schema. New tables added
-- after this date must get an explicit ALTER TABLE ... ENABLE ROW LEVEL
-- SECURITY block below (Supabase's Security Advisor will flag any public
-- table without RLS enabled) — default to the full-lockdown pattern unless
-- the table is genuinely public storefront content.

-- ─────────────────────────────────────────────────────────────────────────────
-- public.promo_banners
--
-- Contains public marketing content (title, subtitle, CTA, image URL).
-- No PII.  Anyone may SELECT; nobody may write via PostgREST (backend
-- handles writes as service_role).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promo_banners_public_select ON public.promo_banners;
CREATE POLICY promo_banners_public_select
  ON public.promo_banners
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- public.identity_sessions
--
-- Contains highly sensitive data:
--   session_id  — secret bearer token (primary key)
--   id_number   — encrypted Ghana Card number
--   full_name, dob, gender — PII
--   photo_b64   — NIA mugshot; MUST NEVER reach any browser
--
-- Zero SELECT/INSERT/UPDATE/DELETE policies = PostgREST returns nothing for
-- every JWT role.  service_role (FastAPI backend) bypasses RLS for all access.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.identity_sessions ENABLE ROW LEVEL SECURITY;

-- Intentionally no policies — full lockdown via PostgREST.

-- ─────────────────────────────────────────────────────────────────────────────
-- Public storefront catalog — genuinely public content, safe for anon/
-- authenticated to SELECT directly. Nobody may write via PostgREST; the
-- backend does all writes as service_role.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS categories_public_select ON public.categories;
CREATE POLICY categories_public_select
  ON public.categories FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brands_public_select ON public.brands;
CREATE POLICY brands_public_select
  ON public.brands FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS collections_public_select ON public.collections;
CREATE POLICY collections_public_select
  ON public.collections FOR SELECT TO anon, authenticated USING (true);

-- products: public, but a direct PostgREST query must never surface a
-- blacklisted (moderated-off) listing the storefront itself would hide.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS products_public_select ON public.products;
CREATE POLICY products_public_select
  ON public.products FOR SELECT TO anon, authenticated
  USING (is_blacklisted = false);

-- comments: public reviews, same rule — never surface a flagged one.
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comments_public_select ON public.comments;
CREATE POLICY comments_public_select
  ON public.comments FOR SELECT TO anon, authenticated
  USING (is_flagged = false);

-- ─────────────────────────────────────────────────────────────────────────────
-- Everything else: accounts, payments/orders, the financial ledger, auth
-- credentials/challenges, security telemetry, admin/audit logs, and other
-- per-user activity. All contain PII, money, or auth material and have no
-- legitimate reason to be queried via PostgREST — full lockdown, zero
-- policies, same treatment as identity_sessions above.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification — confirm RLS is now active on every table in the schema.
-- Every row should show rls_enabled = true; investigate any that don't
-- before trusting Supabase's Security Advisor to go quiet.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  rowsecurity      AS rls_enabled,
  forcerowsecurity AS rls_forced
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

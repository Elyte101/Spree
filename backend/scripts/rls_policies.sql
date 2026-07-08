-- RLS policies for Spree — run once in the Supabase SQL Editor (or via psql).
-- Idempotent: safe to re-run. Last updated: 2026-07-08.
--
-- Architecture note
-- -----------------
-- The FastAPI backend connects as service_role (DATABASE_SUPABASE_SERVICE_ROLE_KEY).
-- service_role bypasses RLS entirely, so these policies only affect direct
-- PostgREST / Supabase client access.  The frontend NEVER queries Supabase
-- directly — all DB access goes through the backend API.

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
-- Verification — confirm RLS is now active on both tables.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  rowsecurity   AS rls_enabled,
  forcerowsecurity AS rls_forced
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('promo_banners', 'identity_sessions')
ORDER BY tablename;

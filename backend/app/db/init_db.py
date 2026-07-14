import logging
from datetime import datetime, timezone

from sqlalchemy import inspect, select, text

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Base, SiteSetting, User
from app.db.session import SessionLocal, engine

logger = logging.getLogger(__name__)

# Columns added after the initial schema that must be backfilled on existing DBs.
# Each entry: (table_name, column_name, postgresql_type, sqlite_type)
_COLUMN_MIGRATIONS: list[tuple[str, str, str, str]] = [
    ("orders", "idempotency_key", "VARCHAR(128)", "TEXT"),
    ("orders", "paystack_tx_id", "VARCHAR(128)", "TEXT"),
    ("products", "is_blacklisted", "BOOLEAN NOT NULL DEFAULT FALSE", "INTEGER NOT NULL DEFAULT 0"),
    ("users", "is_blacklisted", "BOOLEAN NOT NULL DEFAULT FALSE", "INTEGER NOT NULL DEFAULT 0"),
    ("users", "last_login_at", "TIMESTAMP WITH TIME ZONE", "TEXT"),
    # Onboarding & verification
    ("users", "onboarding_step", "INTEGER NOT NULL DEFAULT 0", "INTEGER NOT NULL DEFAULT 0"),
    ("users", "rejection_reason", "TEXT", "TEXT"),
    ("users", "notification_prefs", "JSONB", "TEXT"),
    # Extended notification channels
    ("notifications", "event_type", "VARCHAR(64)", "TEXT"),
    ("notifications", "channel", "VARCHAR(16) NOT NULL DEFAULT 'in_app'", "TEXT NOT NULL DEFAULT 'in_app'"),
    ("notifications", "is_sent", "BOOLEAN NOT NULL DEFAULT TRUE", "INTEGER NOT NULL DEFAULT 1"),
    # Tiered commission rate recorded per order item for accurate vendor payout
    ("order_items", "commission_rate", "NUMERIC(12,8)", "REAL"),
    # G26: soft-delete for users
    ("users", "deleted_at", "TIMESTAMP WITH TIME ZONE", "TEXT"),
    # G37: seller state-change timestamps
    ("users", "verified_at", "TIMESTAMP WITH TIME ZONE", "TEXT"),
    ("users", "rejected_at", "TIMESTAMP WITH TIME ZONE", "TEXT"),
    ("users", "suspended_at", "TIMESTAMP WITH TIME ZONE", "TEXT"),
    # NIA identity verification (replaces Ghana Card image upload)
    ("users", "nia_verified_at", "TIMESTAMP WITH TIME ZONE", "TEXT"),
    ("users", "nia_match_confidence", "NUMERIC(5,4)", "REAL"),
    ("users", "verification_attempt_count", "INTEGER NOT NULL DEFAULT 0", "INTEGER NOT NULL DEFAULT 0"),
    # One-card-per-account uniqueness: HMAC-SHA256 of the normalised Ghana Card number
    ("users", "government_id_hash", "VARCHAR(64)", "TEXT"),
    # H3: store Paystack access_code so idempotent replay can return a real authorization URL
    ("orders", "paystack_access_code", "VARCHAR(128)", "TEXT"),
    # Payout lifecycle: pending_account | processing | released | failed | reversed
    ("orders", "payout_status", "VARCHAR(32)", "TEXT"),
    # A6: password-reset token type marker; A6/A10: session-invalidation stamp
    ("verification_tokens", "purpose", "VARCHAR(32) NOT NULL DEFAULT 'email_verification'", "TEXT NOT NULL DEFAULT 'email_verification'"),
    ("users", "password_changed_at", "TIMESTAMP WITH TIME ZONE", "TEXT"),
    # App-generated tracking ID per order item, embedding product_id — set at
    # checkout, distinct from the seller-entered courier tracking_number.
    ("order_items", "tracking_id", "VARCHAR(80)", "TEXT"),
]

# Column type upgrades for columns that already exist but need wider precision.
# Each entry: (table, column, postgresql_alter_sql)
_COLUMN_TYPE_UPGRADES: list[tuple[str, str, str]] = [
    ("order_items", "commission_rate",
     "ALTER TABLE order_items ALTER COLUMN commission_rate TYPE NUMERIC(12,8)"),
]

# Constraints added after the initial schema, for tables that may already
# exist (without the constraint) on a deployed database. Postgres-only —
# SQLite can't ADD CONSTRAINT on an existing table, and local/dev databases
# are disposable, so a fresh create_all() there already bakes the constraint
# in via __table_args__.
_CONSTRAINT_MIGRATIONS: list[str] = [
    # One review per buyer per product (G21 follow-up).
    """
    DO $$ BEGIN
        ALTER TABLE comments ADD CONSTRAINT uq_comment_product_user UNIQUE (product_id, user_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    """,
]

# RLS migrations — PostgreSQL / Supabase only.
# Executed once per table; idempotent (ENABLE ROW LEVEL SECURITY is a no-op
# when already enabled; DROP POLICY IF EXISTS + CREATE POLICY replaces safely).
#
# Design intent:
#   promo_banners    — public marketing content; anyone may SELECT, nobody may
#                      write via PostgREST (backend uses service_role which
#                      bypasses RLS for all writes).
#   identity_sessions — contains NIA mugshot, encrypted Ghana Card number, DOB,
#                      full name, and a secret session_id.  No PostgREST policy
#                      at all = complete lockdown; service_role bypasses RLS for
#                      backend reads/writes.
#   comments         — product reviews (G21). Anyone may SELECT non-flagged
#                      rows; writes only via FastAPI's service_role, which
#                      enforces auth, email verification, rate limiting, and
#                      verified-purchaser checks that PostgREST can't express.
_RLS_STATEMENTS: list[str] = [
    # ── Enable RLS ────────────────────────────────────────────────────────────
    "ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.identity_sessions ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY",
    # ── promo_banners: public read ────────────────────────────────────────────
    "DROP POLICY IF EXISTS promo_banners_public_select ON public.promo_banners",
    (
        "CREATE POLICY promo_banners_public_select"
        " ON public.promo_banners"
        " FOR SELECT TO anon, authenticated"
        " USING (true)"
    ),
    # ── comments: public read of non-flagged rows only; no direct writes ─────
    "DROP POLICY IF EXISTS comments_public_select ON public.comments",
    (
        "CREATE POLICY comments_public_select"
        " ON public.comments"
        " FOR SELECT TO anon, authenticated"
        " USING (is_flagged = false)"
    ),
    # identity_sessions: zero policies → PostgREST returns 0 rows for every role.
    # service_role (used by FastAPI) bypasses RLS entirely.
]


def _run_column_migrations(eng) -> None:
    """
    Add columns that were introduced after the initial create_all.
    Uses ADD COLUMN IF NOT EXISTS on PostgreSQL (idempotent).
    Falls back to an inspect-then-alter pattern for SQLite.
    Failures are logged as warnings rather than raised so a missing column
    on a new table does not block startup.
    """
    dialect = eng.dialect.name
    try:
        with eng.connect() as conn:
            if dialect == "postgresql":
                for table, column, pg_type, _ in _COLUMN_MIGRATIONS:
                    conn.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {pg_type}")
                    )
                    logger.debug("Ensured column %s.%s exists", table, column)
                for table, column, alter_sql in _COLUMN_TYPE_UPGRADES:
                    conn.execute(text(alter_sql))
                    logger.debug("Upgraded column type %s.%s", table, column)
                for stmt in _CONSTRAINT_MIGRATIONS:
                    conn.execute(text(stmt))
                    logger.debug("Ensured constraint: %s", stmt.strip()[:72])
            else:
                inspector = inspect(eng)
                for table, column, _, sqlite_type in _COLUMN_MIGRATIONS:
                    existing_tables = inspector.get_table_names()
                    if table not in existing_tables:
                        continue
                    existing_cols = {c["name"] for c in inspector.get_columns(table)}
                    if column not in existing_cols:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {sqlite_type}"))
                        logger.info("Added column %s.%s (SQLite migration)", table, column)
            conn.commit()
    except Exception as exc:
        logger.warning("Column migration warning (non-fatal): %s", exc)


def _run_rls_migrations(eng) -> None:
    """Enable RLS and apply PostgREST access policies on Supabase-exposed tables.

    No-op on SQLite (RLS is a PostgreSQL feature).  Failures are logged as
    warnings — a missing policy is a security concern but must not break startup.
    """
    if eng.dialect.name != "postgresql":
        return
    try:
        with eng.connect() as conn:
            for stmt in _RLS_STATEMENTS:
                conn.execute(text(stmt))
                logger.debug("RLS: %s", stmt[:72])
            conn.commit()
        logger.info("RLS policies applied.")
    except Exception as exc:
        logger.warning("RLS migration warning (non-fatal): %s", exc)


def initialize_database() -> None:
    if not settings.auto_initialize_database:
        return

    if engine is None:
        logger.warning("DATABASE_URL not set — skipping database initialization.")
        return

    if settings.is_deployed:
        # create_all runs on every cold start on Vercel — it adds latency and
        # can mask schema drift.  Set AUTO_INITIALIZE_DATABASE=false in
        # production and use a proper migration (alembic / one-time script).
        logger.warning(
            "auto_initialize_database is True in a deployed environment. "
            "Consider setting AUTO_INITIALIZE_DATABASE=false and running "
            "migrations via a one-time script instead."
        )

    Base.metadata.create_all(bind=engine)
    logger.info("Database schema ready.")
    _run_column_migrations(engine)
    _run_rls_migrations(engine)

    if not settings.should_seed_admin:
        logger.warning("Skipping admin seed: SEED_ADMIN_* env vars not fully configured.")
        return

    with SessionLocal() as session:
        existing = session.scalar(select(User).where(User.email == settings.seed_admin_email))
        if existing is None:
            session.add(
                User(
                    id="user-admin",
                    name=settings.seed_admin_name,
                    email=settings.seed_admin_email,
                    password_hash=hash_password(settings.seed_admin_password),
                    role="admin",
                    seller_status="active",
                    government_id_verified=True,
                    seller_started_at=datetime.now(timezone.utc),
                )
            )
            session.commit()
            logger.info("Seeded admin user: %s", settings.seed_admin_email)

        # G11: seed default pricing settings if not already present.
        import json  # noqa: PLC0415
        _PRICING_DEFAULTS = {
            "processing_fee_rate": "0.015",
            "commission_brackets": json.dumps([[500, "0.08"], [2000, "0.05"], [5000, "0.03"], [None, "0.01"]]),
            "auto_release_days": "7",
            "main_tagline": "Shop Safe. Pay Smart. Delivered.",
        }
        for key, default_value in _PRICING_DEFAULTS.items():
            if not session.get(SiteSetting, key):
                session.add(SiteSetting(key=key, value=default_value))
        session.commit()

        # G11: load current pricing settings into the pricing engine.
        from app.core.pricing import load_settings_from_db  # noqa: PLC0415
        load_settings_from_db(session)

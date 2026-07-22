import logging
import re
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import inspect, select, text

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Base, Category, SiteSetting, User
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
    # Main category / subcategory hierarchy: NULL = main category, set = a
    # subcategory of that main category. No FK constraint here on purpose —
    # SQLite's ADD COLUMN can't attach one to an existing table, and Postgres
    # would need the referenced row to already exist at ALTER time; the app
    # never relies on DB-level FK enforcement for this, only on the ORM
    # relationship, so keeping the migration a plain column keeps it valid on
    # both dialects and safe to run in any order.
    ("categories", "parent_id", "VARCHAR(64)", "TEXT"),
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
# Auto-applied on every startup where this runs (see initialize_database())
# — gated behind AUTO_INITIALIZE_DATABASE, which production may have turned
# off (see the warning below). backend/scripts/rls_policies.sql is the exact
# same statements in raw-SQL form, for pasting into the Supabase SQL Editor
# directly — keep the two in sync; this Python list is not generated from it.
#
# Every table in the schema must appear here. Two tiers:
#   - Public storefront content (promo_banners, categories, brands,
#     collections, products, comments): a public SELECT-only policy, since
#     these are genuinely public and PostgREST returning them directly isn't
#     a leak. products/comments are filtered to hide blacklisted/flagged rows
#     even from a direct PostgREST query.
#   - Everything else (accounts, orders, payments, the ledger, auth
#     credentials, security telemetry, admin/audit logs): full lockdown, zero
#     policies, since PostgREST has no legitimate reason to touch any of it.
#
# None of this matters to the app's own operation either way: the FastAPI
# backend connects via DATABASE_URL directly to Postgres (not through
# PostgREST), using a role that owns these tables, so it bypasses RLS
# entirely regardless of what's defined here. These policies are pure
# defense-in-depth against someone hitting PostgREST directly with the
# anon/authenticated key. (DATABASE_SUPABASE_SERVICE_ROLE_KEY is a different,
# unrelated credential — used only by the frontend's own Next.js routes for
# Supabase Storage uploads, not by this backend or by anything RLS-relevant.)
_RLS_STATEMENTS: list[str] = [
    # ── Enable RLS on every table ────────────────────────────────────────────
    "ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.products ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.identity_sessions ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.users ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.verification_audit_logs ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.seller_follows ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.seller_reports ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.product_likes ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.rate_limit_events ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY",
    # ── promo_banners: public read ────────────────────────────────────────────
    "DROP POLICY IF EXISTS promo_banners_public_select ON public.promo_banners",
    (
        "CREATE POLICY promo_banners_public_select"
        " ON public.promo_banners"
        " FOR SELECT TO anon, authenticated"
        " USING (true)"
    ),
    # ── categories/brands/collections: public read ───────────────────────────
    "DROP POLICY IF EXISTS categories_public_select ON public.categories",
    (
        "CREATE POLICY categories_public_select"
        " ON public.categories FOR SELECT TO anon, authenticated USING (true)"
    ),
    "DROP POLICY IF EXISTS brands_public_select ON public.brands",
    (
        "CREATE POLICY brands_public_select"
        " ON public.brands FOR SELECT TO anon, authenticated USING (true)"
    ),
    "DROP POLICY IF EXISTS collections_public_select ON public.collections",
    (
        "CREATE POLICY collections_public_select"
        " ON public.collections FOR SELECT TO anon, authenticated USING (true)"
    ),
    # ── products: public read, but never a blacklisted row ──────────────────
    "DROP POLICY IF EXISTS products_public_select ON public.products",
    (
        "CREATE POLICY products_public_select"
        " ON public.products FOR SELECT TO anon, authenticated"
        " USING (is_blacklisted = false)"
    ),
    # ── comments: public read of non-flagged rows only; no direct writes ─────
    "DROP POLICY IF EXISTS comments_public_select ON public.comments",
    (
        "CREATE POLICY comments_public_select"
        " ON public.comments"
        " FOR SELECT TO anon, authenticated"
        " USING (is_flagged = false)"
    ),
    # identity_sessions and everything in the "full lockdown" tier above get
    # zero policies → PostgREST returns 0 rows for every role. The FastAPI
    # backend's direct DATABASE_URL connection bypasses RLS for all access.
]


def _run_one_statement(eng, statement: str, label: str) -> None:
    """Run a single migration statement in its own connection/transaction.

    Each call is isolated on purpose: these statements used to run as one
    batch sharing a single transaction, so any single failure (e.g. an ADD
    CONSTRAINT rejected by preexisting duplicate data) aborted that whole
    transaction and silently rolled back every other statement queued behind
    it — which is exactly how order_items.tracking_id (last entry in
    _COLUMN_MIGRATIONS) ended up permanently missing in production: an
    earlier, unrelated statement kept failing on every startup, and its
    failure kept discarding this one along with it. Isolating each statement
    means one bad migration can only ever cost itself.
    """
    try:
        with eng.connect() as conn:
            conn.execute(text(statement))
            conn.commit()
        logger.debug("Migration ok: %s", label)
    except Exception as exc:
        logger.warning("Migration warning (non-fatal) for %s: %s", label, exc)


def _run_column_migrations(eng) -> None:
    """
    Add columns that were introduced after the initial create_all.
    Uses ADD COLUMN IF NOT EXISTS on PostgreSQL (idempotent).
    Falls back to an inspect-then-alter pattern for SQLite.
    Each statement is isolated (see _run_one_statement) so a failure in one
    never blocks the rest, and is logged as a warning rather than raised so
    a missing column on a new table does not block startup.
    """
    dialect = eng.dialect.name
    if dialect == "postgresql":
        for table, column, pg_type, _ in _COLUMN_MIGRATIONS:
            _run_one_statement(
                eng,
                f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {pg_type}",
                f"add column {table}.{column}",
            )
        for table, column, alter_sql in _COLUMN_TYPE_UPGRADES:
            _run_one_statement(eng, alter_sql, f"upgrade column type {table}.{column}")
        for stmt in _CONSTRAINT_MIGRATIONS:
            _run_one_statement(eng, stmt, f"constraint: {stmt.strip()[:72]}")
    else:
        try:
            with eng.connect() as conn:
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

    No-op on SQLite (RLS is a PostgreSQL feature). Each statement is isolated
    (see _run_one_statement) so one failing ALTER/POLICY can't roll back the
    others sharing the batch, and is logged as a warning rather than raised —
    a missing policy is a security concern but must not break startup.
    """
    if eng.dialect.name != "postgresql":
        return
    for stmt in _RLS_STATEMENTS:
        _run_one_statement(eng, stmt, stmt[:72])
    logger.info("RLS policies applied.")


_CATEGORY_PLACEHOLDER_IMAGE = "https://placehold.co/600x600/655AFF/FFFFFF?text=Spree"

# Main category -> subcategory tree offered at product creation (see
# productCreateForm.tsx's cascading Category / Subcategory selects). Seeded
# idempotently on every startup (see _seed_category_taxonomy) rather than via
# the manual backend/app/seeds/catalog.py script, since that script is never
# run automatically in production — sellers would otherwise have nothing to
# pick from. Matched by slug, so re-running never duplicates or reparents
# anything; ad-hoc categories a seller already created via free-text entry
# before this taxonomy existed (e.g. "Phones & Accessories") are left
# untouched — this only adds rows, it never renames/deletes/reparents.
_CATEGORY_TAXONOMY: list[tuple[str, list[str]]] = [
    ("Fashion & Apparel", ["Women's Clothing", "Men's Clothing", "Traditional Wear", "Kids' Clothing", "Lingerie & Sleepwear", "Activewear"]),
    ("Shoes & Footwear", ["Women's Shoes", "Men's Shoes", "Kids' Shoes", "Sandals & Slippers", "Sports Shoes"]),
    ("Bags & Accessories", ["Handbags & Purses", "Backpacks", "Wallets", "Belts", "Sunglasses", "Hats & Caps"]),
    ("Beauty & Personal Care", ["Makeup", "Wigs & Hair Extensions", "Nails", "Skincare", "Hair Care", "Fragrances", "Personal Hygiene"]),
    ("Health & Wellness", ["Supplements & Vitamins", "Medical Supplies", "Fitness & Wellness Devices"]),
    ("Electronics & Gadgets", ["Mobile Phones", "Laptops & Computers", "Audio & Headphones", "Cameras", "Phone & Computer Accessories", "Smart Watches & Wearables"]),
    ("Home & Living", ["Furniture", "Bedding & Linens", "Home Décor", "Storage & Organization", "Lighting"]),
    ("Kitchen & Dining", ["Cookware", "Kitchen Appliances", "Dinnerware & Cutlery", "Food Storage"]),
    ("Food & Groceries", ["Snacks", "Beverages", "Spices & Seasonings", "Fresh Produce", "Grains & Staples"]),
    ("Fabrics & Textiles", ["African Print Fabric", "Lace Fabric", "Plain & Cotton Fabric", "Silk & Chiffon"]),
    ("Sports & Fitness", ["Gym Equipment", "Team Sports", "Outdoor & Camping", "Bicycles"]),
    ("Books & Stationery", ["Books", "School Supplies", "Office Stationery", "Art Supplies"]),
    ("Toys & Games", ["Educational Toys", "Action Figures & Dolls", "Board Games & Puzzles", "Outdoor Play"]),
    ("Baby & Kids", ["Diapers & Wipes", "Baby Feeding", "Baby Gear", "Kids' Furniture"]),
    ("Jewelry & Watches", ["Necklaces", "Earrings", "Bracelets & Bangles", "Rings", "Watches"]),
    ("Art & Crafts", ["Handmade Crafts", "Craft Supplies", "Paintings & Wall Art"]),
    ("Agriculture & Farming", ["Seeds & Plants", "Farm Tools", "Livestock Supplies"]),
    ("Pet Supplies", ["Pet Food", "Pet Accessories", "Pet Grooming"]),
    ("Automotive", ["Car Accessories", "Car Care", "Motorcycle Parts"]),
    ("Office Supplies", ["Office Furniture", "Printers & Ink", "Filing & Storage"]),
    ("Tools & Hardware", ["Hand Tools", "Power Tools", "Building Materials"]),
    ("Music & Instruments", ["Instruments", "Audio Equipment", "Accessories"]),
]


def _taxonomy_slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower().strip()).strip("-")


def _seed_category_taxonomy(session) -> None:
    try:
        for main_name, children in _CATEGORY_TAXONOMY:
            main_slug = _taxonomy_slug(main_name)
            main_category = session.scalar(select(Category).where(Category.slug == main_slug))
            if main_category is None:
                main_category = Category(
                    id=f"cat-{uuid4().hex[:12]}",
                    name=main_name,
                    slug=main_slug,
                    image=_CATEGORY_PLACEHOLDER_IMAGE,
                )
                session.add(main_category)
                session.flush()

            for child_name in children:
                child_slug = f"{main_slug}-{_taxonomy_slug(child_name)}"
                existing_child = session.scalar(select(Category).where(Category.slug == child_slug))
                if existing_child is None:
                    session.add(
                        Category(
                            id=f"cat-{uuid4().hex[:12]}",
                            name=child_name,
                            slug=child_slug,
                            image=_CATEGORY_PLACEHOLDER_IMAGE,
                            parent_id=main_category.id,
                        )
                    )
        session.commit()
        logger.info("Category taxonomy seeded.")
    except Exception as exc:
        session.rollback()
        logger.warning("Category taxonomy seed warning (non-fatal): %s", exc)


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

    with SessionLocal() as session:
        _seed_category_taxonomy(session)

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

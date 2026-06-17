import logging
from datetime import datetime, timezone

from sqlalchemy import inspect, select, text

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Base, User
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
    # Tiered commission rate recorded per order item for accurate seller payout
    ("order_items", "commission_rate", "NUMERIC(5,4)", "REAL"),
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

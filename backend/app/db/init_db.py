import logging

from sqlalchemy import inspect, select, text

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Base, User
from app.db.session import SessionLocal, engine

logger = logging.getLogger(__name__)


def _ensure_user_profile_columns() -> None:
    inspector = inspect(engine)

    if "users" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    statements: list[str] = []

    column_defs = [
        ("phone", "VARCHAR(32)"),
        ("store_name", "VARCHAR(120)"),
        ("store_slug", "VARCHAR(120)"),
        ("store_tagline", "VARCHAR(160)"),
        ("store_description", "TEXT"),
        ("store_location", "JSON"),
        ("seller_contact", "JSON"),
        ("seller_type", "VARCHAR(32) DEFAULT 'retail'"),
        ("seller_status", "VARCHAR(32) DEFAULT 'buyer'"),
        ("seller_badge", "VARCHAR(80)"),
        ("completed_deliveries", "INTEGER DEFAULT 0"),
        ("average_delivery_days", "NUMERIC(5, 2)"),
        ("seller_notice", "TEXT"),
        ("admin_note", "TEXT"),
        ("government_id_type", "VARCHAR(32)"),
        ("government_id_number", "VARCHAR(64)"),
        ("government_id_verified", "BOOLEAN DEFAULT FALSE"),
        ("seller_started_at", "DATETIME"),
        ("shipping_info", "JSON"),
        ("payment_info", "JSON"),
    ]

    for col_name, col_def in column_defs:
        if col_name not in existing_columns:
            statements.append(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")

    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))


def _ensure_product_marketplace_columns() -> None:
    inspector = inspect(engine)

    if "products" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("products")}
    statements: list[str] = []

    if "seller_id" not in existing_columns:
        statements.append("ALTER TABLE products ADD COLUMN seller_id VARCHAR(64)")

    if "purchase_count" not in existing_columns:
        statements.append("ALTER TABLE products ADD COLUMN purchase_count INTEGER DEFAULT 0")

    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))


def _ensure_order_lifecycle_columns() -> None:
    inspector = inspect(engine)

    if "orders" not in inspector.get_table_names():
        return

    existing_order_cols = {c["name"] for c in inspector.get_columns("orders")}
    order_col_defs = [
        ("tracking_number", "VARCHAR(120)"),
        ("tracking_carrier", "VARCHAR(80)"),
        ("paid_at", "DATETIME"),
        ("shipped_at", "DATETIME"),
        ("delivered_at", "DATETIME"),
        ("payout_amount", "NUMERIC(10, 2)"),
        ("payout_released_at", "DATETIME"),
    ]
    stmts: list[str] = [
        f"ALTER TABLE orders ADD COLUMN {col} {defn}"
        for col, defn in order_col_defs
        if col not in existing_order_cols
    ]
    if stmts:
        with engine.begin() as conn:
            for s in stmts:
                conn.execute(text(s))

    if "order_items" in inspector.get_table_names():
        existing_item_cols = {c["name"] for c in inspector.get_columns("order_items")}
        if "seller_id" not in existing_item_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE order_items ADD COLUMN seller_id VARCHAR(64)"))

    if "notifications" in inspector.get_table_names():
        existing_notif_cols = {c["name"] for c in inspector.get_columns("notifications")}
        if "recipient_id" not in existing_notif_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE notifications ADD COLUMN recipient_id VARCHAR(64)"))


def _ensure_payment_and_id_columns() -> None:
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    if "users" in tables:
        existing = {c["name"] for c in inspector.get_columns("users")}
        user_cols = [
            ("payout_info", "JSON"),
            ("paystack_recipient_code", "VARCHAR(128)"),
            ("id_front_url", "VARCHAR(512)"),
            ("id_back_url", "VARCHAR(512)"),
            ("selfie_url", "VARCHAR(512)"),
        ]
        stmts = [
            f"ALTER TABLE users ADD COLUMN {col} {defn}"
            for col, defn in user_cols
            if col not in existing
        ]
        if stmts:
            with engine.begin() as conn:
                for s in stmts:
                    conn.execute(text(s))

    if "orders" in tables:
        existing = {c["name"] for c in inspector.get_columns("orders")}
        order_cols = [
            ("paystack_reference", "VARCHAR(128)"),
            ("paystack_tx_id", "VARCHAR(128)"),
            ("estimated_delivery_days", "INTEGER"),
            ("estimated_delivery_date", "DATETIME"),
        ]
        stmts = [
            f"ALTER TABLE orders ADD COLUMN {col} {defn}"
            for col, defn in order_cols
            if col not in existing
        ]
        if stmts:
            with engine.begin() as conn:
                for s in stmts:
                    conn.execute(text(s))


def _ensure_seller_follow_unique_constraint() -> None:
    inspector = inspect(engine)

    if "seller_follows" not in inspector.get_table_names():
        return

    # SQLite doesn't support ADD CONSTRAINT, so we check via index names.
    # The unique constraint was added to the model, so new tables will have it.
    # For existing SQLite DBs, add a unique index if missing.
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("seller_follows")}
    if "uq_seller_follow" not in existing_indexes:
        try:
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_seller_follow "
                        "ON seller_follows (seller_id, follower_id)"
                    )
                )
        except Exception:
            # Index may already exist under a different name; deduplicate rows first.
            with engine.begin() as connection:
                connection.execute(
                    text(
                        "DELETE FROM seller_follows WHERE rowid NOT IN ("
                        "  SELECT MIN(rowid) FROM seller_follows "
                        "  GROUP BY seller_id, follower_id"
                        ")"
                    )
                )


def initialize_database() -> None:
    if not settings.auto_initialize_database:
        return

    if engine is None:
        logger.warning("DATABASE_URL is not configured — skipping database initialization.")
        return

    if settings.sqlite_path:
        settings.sqlite_path.parent.mkdir(parents=True, exist_ok=True)

    Base.metadata.create_all(bind=engine)
    _ensure_user_profile_columns()
    _ensure_product_marketplace_columns()
    _ensure_seller_follow_unique_constraint()
    _ensure_order_lifecycle_columns()
    _ensure_payment_and_id_columns()

    if not settings.should_seed_admin:
        logger.warning(
            "Skipping admin auto-seed because deployed SEED_ADMIN_* environment variables are not fully configured."
        )
        return

    with SessionLocal() as session:
        admin_user = session.scalar(select(User).where(User.email == settings.seed_admin_email))
        if admin_user is None:
            session.add(
                User(
                    id="user-admin",
                    name=settings.seed_admin_name,
                    email=settings.seed_admin_email,
                    password_hash=hash_password(settings.seed_admin_password),
                    role="admin",
                    seller_status="active",
                )
            )

        session.commit()

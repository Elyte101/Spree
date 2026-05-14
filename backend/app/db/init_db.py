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

    if "phone" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN phone VARCHAR(32)")

    if "store_name" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN store_name VARCHAR(120)")

    if "store_slug" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN store_slug VARCHAR(120)")

    if "store_tagline" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN store_tagline VARCHAR(160)")

    if "store_description" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN store_description TEXT")

    if "store_location" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN store_location JSON")

    if "seller_contact" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN seller_contact JSON")

    if "seller_type" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN seller_type VARCHAR(32) DEFAULT 'retail'")

    if "seller_status" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN seller_status VARCHAR(32) DEFAULT 'buyer'")

    if "seller_badge" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN seller_badge VARCHAR(80)")

    if "completed_deliveries" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN completed_deliveries INTEGER DEFAULT 0")

    if "average_delivery_days" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN average_delivery_days NUMERIC(5, 2)")

    if "seller_notice" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN seller_notice TEXT")

    if "admin_note" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN admin_note TEXT")

    if "government_id_type" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN government_id_type VARCHAR(32)")

    if "government_id_number" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN government_id_number VARCHAR(64)")

    if "government_id_verified" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN government_id_verified BOOLEAN DEFAULT FALSE")

    if "seller_started_at" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN seller_started_at DATETIME")

    if "shipping_info" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN shipping_info JSON")

    if "payment_info" not in existing_columns:
        statements.append("ALTER TABLE users ADD COLUMN payment_info JSON")

    if not statements:
        return

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

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def initialize_database() -> None:
    if not settings.auto_initialize_database:
        return

    if settings.sqlite_path:
        settings.sqlite_path.parent.mkdir(parents=True, exist_ok=True)

    Base.metadata.create_all(bind=engine)
    _ensure_user_profile_columns()
    _ensure_product_marketplace_columns()

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

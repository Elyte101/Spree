import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.models import Base, User
from app.db.session import SessionLocal, engine

logger = logging.getLogger(__name__)


def initialize_database() -> None:
    if not settings.auto_initialize_database:
        return

    if engine is None:
        logger.warning("DATABASE_URL not set — skipping database initialization.")
        return

    Base.metadata.create_all(bind=engine)
    logger.info("Database schema ready.")

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

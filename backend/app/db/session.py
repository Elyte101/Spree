from collections.abc import Generator

from fastapi import HTTPException, status
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings


def _build_engine():
    if not settings.database_url:
        return None, None

    # NullPool: no persistent connection pool between serverless invocations.
    # Each request opens and closes its own connection — correct for Vercel.
    eng = create_engine(settings.database_url, poolclass=NullPool, future=True)
    sess = sessionmaker(bind=eng, autoflush=False, autocommit=False, expire_on_commit=False)
    return eng, sess


engine, SessionLocal = _build_engine()


def get_db() -> Generator[Session, None, None]:
    if SessionLocal is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not configured. Set DATABASE_URL in Vercel environment variables.",
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

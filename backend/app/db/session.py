from collections.abc import Generator

from fastapi import HTTPException, status
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


def _build_engine() -> tuple[Engine | None, sessionmaker | None]:
    if not settings.database_url:
        return None, None

    connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
    eng = create_engine(
        settings.database_url,
        future=True,
        pool_pre_ping=True,
        pool_recycle=300,
        connect_args=connect_args,
    )
    sess = sessionmaker(
        bind=eng,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )
    return eng, sess


engine, SessionLocal = _build_engine()


def get_db() -> Generator[Session, None, None]:
    if SessionLocal is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not configured for this environment. Set DATABASE_URL.",
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
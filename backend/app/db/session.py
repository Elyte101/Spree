import logging
import os
from collections.abc import Generator

from fastapi import HTTPException, status
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings

logger = logging.getLogger(__name__)

_engine_init_error: str | None = None


def _build_engine():
    global _engine_init_error

    if not settings.database_url:
        _engine_init_error = (
            "DATABASE_URL is not set. "
            "Add it to your Vercel backend project → Settings → Environment Variables. "
            "Use the non-pooling connection string from your Supabase/Postgres provider "
            "(e.g. DATABASE_POSTGRES_URL_NON_POOLING from the Vercel Supabase integration)."
        )
        logger.error("[db] %s", _engine_init_error)
        return None, None

    try:
        # NullPool: no persistent connection pool between serverless invocations.
        # Each request opens and closes its own connection — correct for Vercel.
        eng = create_engine(settings.database_url, poolclass=NullPool, future=True)
        sess = sessionmaker(bind=eng, autoflush=False, autocommit=False, expire_on_commit=False)
        logger.info("[db] Engine initialised (host redacted).")
        return eng, sess
    except Exception as exc:
        _engine_init_error = f"Failed to create database engine: {exc}"
        logger.error("[db] %s", _engine_init_error)
        return None, None


engine, SessionLocal = _build_engine()


def get_db() -> Generator[Session, None, None]:
    if SessionLocal is None:
        logger.error("[db] get_db() called but engine is not available: %s", _engine_init_error)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_engine_init_error or "Database is not configured.",
        )
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

import logging
import os
import uuid
from collections.abc import Generator

from fastapi import HTTPException, status
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
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
        # Log scheme+host only — never log credentials.
        from urllib.parse import urlparse
        parsed = urlparse(settings.database_url)
        logger.info("[db] Connecting: %s://%s%s", parsed.scheme, parsed.hostname, parsed.path)

        # NullPool: no persistent connection pool between serverless invocations.
        # Each request opens and closes its own connection — correct for Vercel.
        eng = create_engine(settings.database_url, poolclass=NullPool, future=True)
        sess = sessionmaker(bind=eng, autoflush=False, autocommit=False, expire_on_commit=False)
        logger.info("[db] Engine initialised.")
        return eng, sess
    except Exception as exc:
        _engine_init_error = (
            f"Failed to create database engine: {exc}. "
            "Ensure DATABASE_URL is a valid non-pooling PostgreSQL URL "
            "(e.g. postgres://user:pass@host:5432/dbname?sslmode=require)."
        )
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
    except OperationalError as exc:
        # create_engine() is lazy — a bad/unreachable DATABASE_URL (wrong
        # host, rotated credentials, the Postgres instance paused or
        # unreachable from this network) only surfaces here, on the first
        # real query, as an unhandled exception — not at startup. Left
        # uncaught, this propagated straight through FastAPI and out to
        # Vercel's generic function-crash wrapper, which replaced it with an
        # opaque "A server error has occurred" / FUNCTION_INVOCATION_FAILED
        # response and discarded the real cause entirely. Log the real
        # error with a correlation id (safe server-side — OperationalError's
        # message can include the connection target) and fail closed with a
        # clean, honest 503 instead, matching the "DATABASE_URL not set"
        # case above.
        db.rollback()
        request_id = uuid.uuid4().hex[:12]
        logger.error("[db] query failed (request_id=%s): %s", request_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database is temporarily unreachable (request_id={request_id}).",
        ) from exc
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

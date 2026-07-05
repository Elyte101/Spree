import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

DBSession = Annotated[Session, Depends(get_db)]

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# C4: DB-backed rate limiter — survives Vercel serverless invocation boundaries
# ---------------------------------------------------------------------------


def _check_rate_limit(db: Session, key: str, max_calls: int, window_seconds: int) -> None:
    """Raise 429 if the key exceeds max_calls within window_seconds.

    Uses the rate_limit_events DB table so limits are shared across all
    Vercel serverless invocations (not per-process).
    """
    from app.db.models import RateLimitEvent  # noqa: PLC0415 — avoid circular import at module load

    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=window_seconds)

    count = db.scalar(
        select(func.count(RateLimitEvent.id)).where(
            RateLimitEvent.key == key,
            RateLimitEvent.created_at > cutoff,
        )
    ) or 0

    if count >= max_calls:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests — please wait before trying again",
            headers={"Retry-After": str(window_seconds)},
        )

    # Record this call
    db.add(RateLimitEvent(id=f"rl-{uuid4().hex[:18]}", key=key))
    db.commit()

    # Prune old entries (lazy cleanup — best-effort, non-blocking)
    try:
        db.execute(delete(RateLimitEvent).where(RateLimitEvent.created_at < cutoff))
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()


def _comment_rate_limit(
    db: DBSession,
    x_actor_user_id: Annotated[str | None, Header(alias="X-Actor-User-Id")] = None,
) -> None:
    """G31: Rate-limit comment creation — max 5 comments per user per 60 seconds."""
    if x_actor_user_id:
        _check_rate_limit(db, f"comment:{x_actor_user_id}", max_calls=5, window_seconds=60)


CommentRateLimit = Annotated[None, Depends(_comment_rate_limit)]

logger = logging.getLogger(__name__)


def require_internal_api_key(
    x_internal_api_key: Annotated[str | None, Header(alias="X-Internal-Api-Key")] = None,
) -> None:
    if x_internal_api_key is None:
        logger.warning(
            "internal_key_missing: request arrived without X-Internal-Api-Key header. "
            "Check that BACKEND_INTERNAL_API_KEY is set on the frontend Vercel project "
            "and that all proxyBackend() calls pass { internal: true }."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Internal API key is required",
        )
    if not secrets.compare_digest(x_internal_api_key, settings.backend_internal_api_key):
        logger.warning(
            "internal_key_mismatch: received key does not match BACKEND_INTERNAL_API_KEY. "
            "Set the SAME secret value on both the frontend and backend Vercel projects."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )


def _get_actor_user_id(
    x_actor_user_id: Annotated[str | None, Header(alias="X-Actor-User-Id")] = None,
) -> str | None:
    return x_actor_user_id


def _get_actor_role(
    x_actor_role: Annotated[str | None, Header(alias="X-Actor-Role")] = None,
) -> str:
    return x_actor_role or "customer"


def check_optional_internal_key(
    x_internal_api_key: Annotated[str | None, Header(alias="X-Internal-Api-Key")] = None,
) -> bool:
    if x_internal_api_key is None:
        return False
    return secrets.compare_digest(x_internal_api_key, settings.backend_internal_api_key)


InternalAPIKey = Annotated[None, Depends(require_internal_api_key)]
OptionalInternalKey = Annotated[bool, Depends(check_optional_internal_key)]
ActorUserId = Annotated[str | None, Depends(_get_actor_user_id)]
ActorRole = Annotated[str, Depends(_get_actor_role)]

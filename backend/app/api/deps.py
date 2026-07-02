import logging
import secrets
import time
from collections import defaultdict
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

DBSession = Annotated[Session, Depends(get_db)]

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# G31: Simple in-memory rate limiter (per user, resets on process restart)
# ---------------------------------------------------------------------------

# Stores {user_id: [timestamp1, timestamp2, ...]} of recent action timestamps.
_rate_limit_buckets: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(user_id: str, max_calls: int, window_seconds: int) -> None:
    """Raise 429 if the user exceeds max_calls within window_seconds."""
    now = time.monotonic()
    cutoff = now - window_seconds
    bucket = _rate_limit_buckets[user_id]
    # Prune old entries
    _rate_limit_buckets[user_id] = [t for t in bucket if t > cutoff]
    if len(_rate_limit_buckets[user_id]) >= max_calls:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many requests — please wait before trying again",
            headers={"Retry-After": str(window_seconds)},
        )
    _rate_limit_buckets[user_id].append(now)


def _comment_rate_limit(
    x_actor_user_id: Annotated[str | None, Header(alias="X-Actor-User-Id")] = None,
) -> None:
    """G31: Rate-limit comment creation — max 5 comments per user per 60 seconds."""
    if x_actor_user_id:
        _check_rate_limit(f"comment:{x_actor_user_id}", max_calls=5, window_seconds=60)


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

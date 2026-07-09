import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import uuid4

import jwt
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


# ---------------------------------------------------------------------------
# A2: actor identity comes from a signed, short-lived token minted by the
# Next proxy (lib/actorToken.ts), not from the plain X-Actor-User-Id/Role
# headers. Those headers alone were spoofable by anyone who could reach the
# backend directly with a valid (or leaked) internal key. The token binds
# id + role together with an expiry, verified here with the shared
# ACTOR_TOKEN_SECRET. A present-but-invalid/expired token is rejected
# outright (401) rather than silently falling back to anonymous, so a
# tampered or replayed token can't quietly downgrade into "no actor".
# ---------------------------------------------------------------------------

_ACTOR_TOKEN_ISSUER = "spree-next-proxy"
_ACTOR_TOKEN_AUDIENCE = "spree-backend"


def _decode_actor_token(token: str) -> tuple[str, str]:
    try:
        claims = jwt.decode(
            token,
            settings.actor_token_secret,
            algorithms=["HS256"],
            issuer=_ACTOR_TOKEN_ISSUER,
            audience=_ACTOR_TOKEN_AUDIENCE,
        )
    except jwt.InvalidTokenError as exc:
        logger.warning("actor_token_invalid: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired actor token",
        ) from exc

    actor_id = claims.get("sub")
    actor_role = claims.get("role") or "customer"
    if not actor_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid actor token",
        )
    return actor_id, actor_role


def _get_actor(
    db: DBSession,
    x_actor_token: Annotated[str | None, Header(alias="X-Actor-Token")] = None,
) -> tuple[str | None, str]:
    if not x_actor_token:
        return None, "customer"
    actor_id, _token_role = _decode_actor_token(x_actor_token)

    # A10: re-derive role from the current DB row rather than trusting the
    # token's role claim. The claim reflects the Next-side session at the
    # time it was last refreshed (up to `session.maxAge`, currently 24h) —
    # a seller blacklisted or demoted by an admin in the meantime would
    # otherwise keep acting under their old role until that session expires.
    # A blacklisted/soft-deleted user is treated as fully anonymous.
    from app.db.models import User  # noqa: PLC0415 — avoid circular import at module load

    user = db.get(User, actor_id)
    if user is None or user.deleted_at is not None or user.is_blacklisted:
        return None, "customer"
    return actor_id, user.role


def _get_actor_user_id(actor: Annotated[tuple[str | None, str], Depends(_get_actor)]) -> str | None:
    return actor[0]


def _get_actor_role(actor: Annotated[tuple[str | None, str], Depends(_get_actor)]) -> str:
    return actor[1]


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

import secrets
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

DBSession = Annotated[Session, Depends(get_db)]


def require_internal_api_key(
    x_internal_api_key: Annotated[str | None, Header(alias="X-Internal-Api-Key")] = None,
) -> None:
    if x_internal_api_key is None or not secrets.compare_digest(
        x_internal_api_key, settings.internal_api_key
    ):
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


InternalAPIKey = Annotated[None, Depends(require_internal_api_key)]
ActorUserId = Annotated[str | None, Depends(_get_actor_user_id)]
ActorRole = Annotated[str, Depends(_get_actor_role)]

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db

DBSession = Annotated[Session, Depends(get_db)]


def require_internal_api_key(
    x_internal_api_key: Annotated[str | None, Header(alias="X-Internal-Api-Key")] = None,
) -> None:
    if x_internal_api_key != settings.internal_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API key",
        )


InternalAPIKey = Annotated[None, Depends(require_internal_api_key)]

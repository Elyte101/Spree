"""Web push subscription management."""
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import PushSubscription


def upsert_push_subscription(
    db: Session, user_id: str, endpoint: str, p256dh: str, auth: str
) -> dict:
    # Replace any existing subscription with the same endpoint
    existing = db.scalar(
        select(PushSubscription).where(
            PushSubscription.user_id == user_id,
            PushSubscription.endpoint == endpoint,
        )
    )
    if existing:
        existing.p256dh = p256dh
        existing.auth = auth
    else:
        db.add(PushSubscription(
            id=f"push-{uuid4().hex[:16]}",
            user_id=user_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
        ))
    db.commit()
    return {"status": "ok"}


def delete_push_subscription(db: Session, user_id: str, endpoint: str) -> None:
    db.execute(
        delete(PushSubscription).where(
            PushSubscription.user_id == user_id,
            PushSubscription.endpoint == endpoint,
        )
    )
    db.commit()

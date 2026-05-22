from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db.models import Notification


def create_notification(
    db: Session,
    title: str,
    body: str,
    notif_type: str,
    href: str | None = None,
    recipient_id: str | None = None,
) -> None:
    db.add(
        Notification(
            id=f"notif-{uuid4().hex[:16]}",
            recipient_id=recipient_id,
            title=title,
            body=body,
            created_at=datetime.now(timezone.utc),
            is_read=False,
            type=notif_type,
            href=href,
        )
    )


def list_notifications(db: Session, recipient_id: str | None = None) -> list[dict]:
    if recipient_id:
        # User sees their own notifications + global ones (no recipient)
        stmt = (
            select(Notification)
            .where(
                or_(
                    Notification.recipient_id == recipient_id,
                    Notification.recipient_id.is_(None),
                )
            )
            .order_by(Notification.created_at.desc())
        )
    else:
        # Unauthenticated: only global notifications
        stmt = (
            select(Notification)
            .where(Notification.recipient_id.is_(None))
            .order_by(Notification.created_at.desc())
        )

    notifications = db.scalars(stmt).all()

    return [
        {
            "id": item.id,
            "title": item.title,
            "body": item.body,
            "createdAt": item.created_at.isoformat().replace("+00:00", "Z"),
            "isRead": item.is_read,
            "type": item.type,
            "href": item.href,
        }
        for item in notifications
    ]

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Notification


def list_notifications(db: Session) -> list[dict]:
    notifications = db.scalars(
        select(Notification).order_by(Notification.created_at.desc())
    ).all()

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


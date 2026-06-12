from fastapi import APIRouter, HTTPException

from app.api.deps import ActorUserId, DBSession, InternalAPIKey
from app.schemas.notification import NotificationOut, UnreadCountOut
from app.services.notifications import (
    get_unread_count,
    list_notifications,
    mark_all_read,
    mark_notification_read,
)

router = APIRouter()


@router.get("/notifications", response_model=list[NotificationOut])
def notifications(db: DBSession, actor_id: ActorUserId):
    return list_notifications(db, recipient_id=actor_id)


@router.get("/notifications/unread-count", response_model=UnreadCountOut)
def notifications_unread_count(db: DBSession, actor_id: ActorUserId):
    if not actor_id:
        return {"count": 0}
    return {"count": get_unread_count(db, actor_id)}


@router.patch("/notifications/{notification_id}/read")
def notification_mark_read(
    notification_id: str,
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
):
    if not actor_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    ok = mark_notification_read(db, notification_id, actor_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@router.post("/notifications/read-all")
def notifications_mark_all_read(db: DBSession, _: InternalAPIKey, actor_id: ActorUserId):
    if not actor_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    mark_all_read(db, actor_id)
    return {"ok": True}

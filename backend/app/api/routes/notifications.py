from fastapi import APIRouter

from app.api.deps import ActorUserId, DBSession
from app.schemas.notification import NotificationOut
from app.services.notifications import list_notifications

router = APIRouter()


@router.get("/notifications", response_model=list[NotificationOut])
def notifications(db: DBSession, actor_id: ActorUserId):
    return list_notifications(db, recipient_id=actor_id)

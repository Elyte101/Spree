from fastapi import APIRouter

from app.api.deps import DBSession
from app.schemas.notification import NotificationOut
from app.services.notifications import list_notifications

router = APIRouter()


@router.get("/notifications", response_model=list[NotificationOut])
def notifications(db: DBSession):
    return list_notifications(db)


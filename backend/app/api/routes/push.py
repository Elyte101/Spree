from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException

from app.api.deps import ActorUserId, DBSession, InternalAPIKey
from app.services.push import delete_push_subscription, upsert_push_subscription

router = APIRouter()


class PushSubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=10)
    p256dh: str = Field(min_length=10)
    auth: str = Field(min_length=4)


class PushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=10)


@router.post("/push/subscribe")
def push_subscribe(
    payload: PushSubscribeRequest,
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
):
    if not actor_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return upsert_push_subscription(db, actor_id, payload.endpoint, payload.p256dh, payload.auth)


@router.delete("/push/subscribe")
def push_unsubscribe(
    payload: PushUnsubscribeRequest,
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
):
    if not actor_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    delete_push_subscription(db, actor_id, payload.endpoint)
    return {"ok": True}

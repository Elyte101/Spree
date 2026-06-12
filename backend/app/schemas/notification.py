from typing import Literal

from pydantic import BaseModel


NotificationChannel = Literal["in_app", "email", "push"]
NotificationEventType = Literal[
    "seller_created",
    "docs_submitted",
    "new_verification_pending",
    "seller_approved",
    "seller_rejected",
    "payout_saved",
    "onboarding_reminder",
    "promo",
    "order",
    "stock",
    "account",
]


class NotificationOut(BaseModel):
    id: str
    title: str
    body: str
    createdAt: str
    isRead: bool
    type: str
    href: str | None = None
    eventType: str | None = None
    channel: str = "in_app"


class UnreadCountOut(BaseModel):
    count: int


class MarkReadRequest(BaseModel):
    notificationId: str

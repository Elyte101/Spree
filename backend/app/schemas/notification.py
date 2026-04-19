from typing import Literal

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: str
    title: str
    body: str
    createdAt: str
    isRead: bool
    type: Literal["promo", "order", "stock", "account"]
    href: str | None = None


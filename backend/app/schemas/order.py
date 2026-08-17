import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# Carrier tracking numbers: letters, digits, and internal hyphens only.
# Rejects free text like phone numbers ("+233 55 123 4567") or stray
# lowercase-word entries ("flipshipping952") that slipped in unvalidated.
_TRACKING_NUMBER_RE = re.compile(r"^[A-Za-z0-9]([A-Za-z0-9-]{4,34})[A-Za-z0-9]$")


class OrderItemIn(BaseModel):
    productId: str | None = None
    name: str = Field(min_length=1, max_length=255)
    image: str = Field(max_length=512)
    price: float = Field(gt=0, le=999_999)
    quantity: int = Field(ge=1, le=999)
    color: str | None = Field(default=None, max_length=120)
    size: str | None = Field(default=None, max_length=64)


class OrderCreateIn(BaseModel):
    userId: str | None = None
    idempotencyKey: str | None = Field(default=None, max_length=128)

    fullName: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    phone: str | None = Field(default=None, max_length=32)

    addressLine1: str = Field(min_length=2, max_length=160)
    addressLine2: str | None = Field(default=None, max_length=160)
    city: str = Field(min_length=1, max_length=120)
    state: str = Field(min_length=1, max_length=120)
    postalCode: str = Field(min_length=1, max_length=40)
    country: str = Field(min_length=1, max_length=120)

    shippingMethod: Literal["standard", "express"] = "standard"
    paymentMethod: Literal["momo", "card"] = "momo"

    subtotal: float = Field(ge=0)
    shippingCost: float = Field(ge=0)
    tax: float = Field(ge=0)
    total: float = Field(ge=0)
    currency: str = Field(default="GHS", max_length=8)

    items: list[OrderItemIn] = Field(min_length=1)


class OrderTrackingIn(BaseModel):
    trackingNumber: str = Field(min_length=6, max_length=36)
    carrier: str = Field(default="", max_length=80)
    estimatedDeliveryDays: int | None = Field(default=None, ge=1, le=365)

    @field_validator("trackingNumber")
    @classmethod
    def validate_tracking_number(cls, value: str) -> str:
        cleaned = value.strip()
        if not _TRACKING_NUMBER_RE.match(cleaned):
            raise ValueError(
                "Tracking number must be 6-36 alphanumeric characters (hyphens allowed, "
                "not at the ends) — no spaces, phone numbers, or symbols"
            )
        return cleaned


class ChargeMomoIn(OrderCreateIn):
    momoPhone: str = Field(min_length=10, max_length=20)
    momoProvider: Literal["mtn", "vod", "atl"]


class SubmitOtpIn(BaseModel):
    otp: str = Field(min_length=1, max_length=10)
    reference: str = Field(min_length=1, max_length=128)


class ChargeMomoOut(BaseModel):
    orderId: str
    reference: str
    status: str
    displayText: str


class PaymentInitOut(BaseModel):
    orderId: str
    reference: str
    authorizationUrl: str
    accessCode: str = ""


class PaymentVerifyOut(BaseModel):
    orderId: str
    status: str


class OrderItemOut(BaseModel):
    id: str
    productId: str | None
    sellerId: str | None
    name: str
    image: str
    price: float
    quantity: int
    color: str | None
    size: str | None
    trackingId: str | None = None


class OrderOut(BaseModel):
    id: str
    userId: str | None
    status: str
    fullName: str
    email: str
    phone: str | None
    addressLine1: str
    addressLine2: str | None
    city: str
    state: str
    postalCode: str
    country: str
    shippingMethod: str
    paymentMethod: str
    subtotal: float
    shippingCost: float
    tax: float
    total: float
    currency: str
    trackingNumber: str | None
    trackingCarrier: str | None
    paidAt: datetime | None
    shippedAt: datetime | None
    deliveredAt: datetime | None
    payoutAmount: float | None
    payoutReleasedAt: datetime | None
    paystackReference: str | None
    estimatedDeliveryDays: int | None
    estimatedDeliveryDate: datetime | None
    createdAt: datetime
    items: list[OrderItemOut]


class OrderListItemOut(BaseModel):
    id: str
    status: str
    fullName: str
    email: str
    total: float
    currency: str
    itemCount: int
    shippingMethod: str
    trackingNumber: str | None
    createdAt: datetime

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.auth import GhanaIdType, PaymentInfo, SellerContact, ShippingAddress, StoreLocation
from app.schemas.catalog import ProductOut

SellerType = Literal["retail", "wholesale"]
SellerStatus = Literal[
    "buyer", "incomplete", "pending_verification", "verified",
    "rejected", "active", "pending", "suspended", "removed",
]


class SellerSummaryOut(BaseModel):
    """Public seller shape — no email/phone/sellerContact/adminNote (G17).

    Served by the unauthenticated GET /sellers and /sellers/{id} endpoints,
    so every field here must be safe to show to anyone.
    """
    id: str
    name: str
    role: str
    storeName: str
    storeSlug: str
    storeTagline: str = ""
    storeDescription: str = ""
    storeLocation: StoreLocation
    sellerType: SellerType = "retail"
    sellerStatus: SellerStatus
    sellerBadge: str = ""
    completedDeliveries: int = 0
    averageDeliveryDays: float | None = None
    sellerNotice: str = ""
    governmentIdType: GhanaIdType = "ghana-card"
    governmentIdVerified: bool = False
    isBlacklisted: bool = False
    lastLoginAt: datetime | None = None
    followerCount: int
    productCount: int
    purchaseCount: int
    reportCount: int
    sellerRating: float = 0
    sellerReviewsCount: int = 0
    startedAt: datetime | None = None
    createdAt: datetime


class AdminSellerSummaryOut(SellerSummaryOut):
    """Extended summary with PII — admin-only endpoints (G17)."""
    email: str
    phone: str = ""
    sellerContact: SellerContact
    adminNote: str = ""


class SellerReportOut(BaseModel):
    id: str
    reporterId: str
    reporterName: str
    reason: str
    details: str = ""
    status: str
    createdAt: datetime


class AdminSellerDetailOut(AdminSellerSummaryOut):
    governmentIdNumber: str = ""
    idFrontUrl: str = ""
    idBackUrl: str = ""
    selfieUrl: str = ""
    onboardingStep: int = 0
    rejectionReason: str | None = None
    shippingAddress: ShippingAddress
    paymentInfo: PaymentInfo
    reports: list[SellerReportOut]


class SellerRejectRequest(BaseModel):
    reason: str = Field(min_length=10, max_length=600)


class AdminSellerStatusUpdateRequest(BaseModel):
    status: Literal["pending", "active", "suspended", "removed"]
    sellerNotice: str = Field(default="", max_length=600)
    adminNote: str = Field(default="", max_length=600)
    sellerBadge: str = Field(default="", max_length=80)
    completedDeliveries: int = Field(default=0, ge=0)
    averageDeliveryDays: float | None = Field(default=None, ge=0)
    governmentIdVerified: bool = False


class SellerBlacklistIn(BaseModel):
    blacklisted: bool


class TopProductsResponseOut(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    limit: int
    totalPages: int

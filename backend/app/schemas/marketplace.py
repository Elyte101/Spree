from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.auth import PaymentInfo, SellerContact, ShippingAddress, StoreLocation
from app.schemas.catalog import ProductOut

SellerType = Literal["retail", "wholesale"]
SellerStatus = Literal["buyer", "pending", "active", "suspended", "removed"]


class SellerSummaryOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    phone: str = ""
    storeName: str
    storeSlug: str
    storeTagline: str = ""
    storeDescription: str = ""
    storeLocation: StoreLocation
    sellerContact: SellerContact
    sellerType: SellerType = "retail"
    sellerStatus: SellerStatus
    sellerBadge: str = ""
    completedDeliveries: int = 0
    averageDeliveryDays: float | None = None
    sellerNotice: str = ""
    governmentIdType: str = "ghana-card"
    governmentIdVerified: bool = False
    followerCount: int
    productCount: int
    purchaseCount: int
    reportCount: int
    startedAt: datetime | None = None
    createdAt: datetime


class AdminSellerSummaryOut(SellerSummaryOut):
    """Extended summary that includes admin-only fields."""
    adminNote: str = ""


class SellerReportOut(BaseModel):
    id: str
    reporterId: str
    reporterName: str
    reason: str
    details: str = ""
    status: str
    createdAt: datetime


class SellerDetailOut(SellerSummaryOut):
    products: list[ProductOut]


class AdminSellerDetailOut(AdminSellerSummaryOut):
    governmentIdNumber: str = ""
    shippingAddress: ShippingAddress
    paymentInfo: PaymentInfo
    reports: list[SellerReportOut]


class FollowSellerRequest(BaseModel):
    followerId: str = Field(min_length=3, max_length=64)


class UnfollowSellerRequest(BaseModel):
    followerId: str = Field(min_length=3, max_length=64)


class ReportSellerRequest(BaseModel):
    reporterId: str = Field(min_length=3, max_length=64)
    reason: Literal[
        "counterfeit",
        "fraud",
        "abuse",
        "delivery-issue",
        "misleading-listing",
        "other",
    ]
    details: str = Field(default="", max_length=600)


class AdminSellerStatusUpdateRequest(BaseModel):
    status: Literal["pending", "active", "suspended", "removed"]
    sellerNotice: str = Field(default="", max_length=600)
    adminNote: str = Field(default="", max_length=600)
    sellerBadge: str = Field(default="", max_length=80)
    completedDeliveries: int = Field(default=0, ge=0)
    averageDeliveryDays: float | None = Field(default=None, ge=0)
    governmentIdVerified: bool = False


class TopProductsResponseOut(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    limit: int
    totalPages: int

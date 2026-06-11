from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

SellerType = Literal["retail", "wholesale"]
SellerStatus = Literal["buyer", "pending", "active", "suspended", "removed"]


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class AuthUserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    email_verified: bool = False


class OAuthUpsertRequest(BaseModel):
    email: str
    name: str
    provider: str
    provider_account_id: str


class SendVerificationRequest(BaseModel):
    email: str


class VerifyEmailRequest(BaseModel):
    token: str


class ShippingAddress(BaseModel):
    fullName: str = Field(default="", max_length=120)
    addressLine1: str = Field(default="", max_length=160)
    addressLine2: str = Field(default="", max_length=160)
    city: str = Field(default="", max_length=120)
    state: str = Field(default="", max_length=120)
    postalCode: str = Field(default="", max_length=40)
    country: str = Field(default="", max_length=120)


class PaymentInfo(BaseModel):
    method: Literal["card", "paypal", "bank-transfer"] = "card"
    cardholderName: str = Field(default="", max_length=120)
    cardLast4: str = Field(default="", max_length=4)
    expiryMonth: str = Field(default="", max_length=2)
    expiryYear: str = Field(default="", max_length=4)
    billingPostalCode: str = Field(default="", max_length=40)


GhanaIdType = Literal["ghana-card", "voters-id", "drivers-license", "passport", "ecowas-card", "ssnit"]


class SellerIdentityInfo(BaseModel):
    governmentIdType: GhanaIdType = "ghana-card"
    governmentIdNumber: str = Field(default="", max_length=64)
    storeTagline: str = Field(default="", max_length=160)


class StoreLocation(BaseModel):
    addressLine1: str = Field(default="", max_length=160)
    city: str = Field(default="", max_length=120)
    state: str = Field(default="", max_length=120)
    postalCode: str = Field(default="", max_length=40)
    country: str = Field(default="", max_length=120)


class SellerContact(BaseModel):
    businessEmail: str = Field(default="", max_length=255)
    businessPhone: str = Field(default="", max_length=32)
    whatsapp: str = Field(default="", max_length=32)
    registrationNumber: str = Field(default="", max_length=80)


class PayoutInfoRequest(BaseModel):
    method: Literal["bank", "mobile_money"] = "bank"
    bankName: str = Field(default="", max_length=120)
    accountNumber: str = Field(default="", max_length=32)
    bankCode: str = Field(default="", max_length=20)
    mobileMoneyNetwork: str = Field(default="", max_length=20)
    mobileMoneyNumber: str = Field(default="", max_length=20)
    currency: str = Field(default="GH₵", max_length=8)
    accountName: str = Field(default="", max_length=120)


class ProfileUpdateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    phone: str = Field(default="", max_length=32)
    isSeller: bool = False
    storeName: str = Field(default="", max_length=120)
    sellerType: SellerType = "retail"
    storeDescription: str = Field(default="", max_length=500)
    storeLocation: StoreLocation = Field(default_factory=StoreLocation)
    sellerContact: SellerContact = Field(default_factory=SellerContact)
    sellerIdentity: SellerIdentityInfo = Field(default_factory=SellerIdentityInfo)
    shippingAddress: ShippingAddress = Field(default_factory=ShippingAddress)
    paymentInfo: PaymentInfo = Field(default_factory=PaymentInfo)


class UserProfileOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    phone: str = ""
    storeName: str = ""
    storeSlug: str = ""
    storeTagline: str = ""
    storeDescription: str = ""
    storeLocation: StoreLocation
    sellerContact: SellerContact
    sellerType: SellerType = "retail"
    sellerStatus: SellerStatus = "buyer"
    sellerBadge: str = ""
    completedDeliveries: int = 0
    averageDeliveryDays: float | None = None
    sellerNotice: str = ""
    adminNote: str = ""
    governmentIdType: GhanaIdType = "ghana-card"
    governmentIdNumber: str = ""
    governmentIdVerified: bool = False
    sellerStartedAt: datetime | None = None
    sellerIdentity: SellerIdentityInfo
    shippingAddress: ShippingAddress
    paymentInfo: PaymentInfo
    payoutInfo: dict = {}
    idFrontUrl: str = ""
    idBackUrl: str = ""
    selfieUrl: str = ""

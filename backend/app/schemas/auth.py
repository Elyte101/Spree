from typing import Literal

from pydantic import BaseModel, Field


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


class ProfileUpdateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    phone: str = Field(default="", max_length=32)
    isSeller: bool = False
    storeName: str = Field(default="", max_length=120)
    storeDescription: str = Field(default="", max_length=500)
    shippingAddress: ShippingAddress = Field(default_factory=ShippingAddress)
    paymentInfo: PaymentInfo = Field(default_factory=PaymentInfo)


class UserProfileOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    phone: str = ""
    storeName: str = ""
    storeDescription: str = ""
    shippingAddress: ShippingAddress
    paymentInfo: PaymentInfo

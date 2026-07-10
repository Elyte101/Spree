from datetime import datetime

from pydantic import BaseModel, Field


class WebAuthnOptionsOut(BaseModel):
    options: dict
    challengeId: str


class WebAuthnRegistrationVerifyIn(BaseModel):
    challengeId: str
    credential: dict
    deviceName: str = Field(default="", max_length=120)


class WebAuthnAuthenticationVerifyIn(BaseModel):
    challengeId: str
    credential: dict


class WebAuthnCredentialOut(BaseModel):
    id: str
    deviceName: str
    createdAt: datetime
    lastUsedAt: datetime | None = None

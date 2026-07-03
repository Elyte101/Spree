"""NIA Ghana Card verification — Smile ID backend.

Provider-agnostic interface: IdentityProvider.verify_ghana_card(id_number).
Concrete implementations:
  • SmileIDProvider  — live calls to api.smileidentity.com/v1/id_verification
  • MockProvider     — local simulation (no network, no credentials required)

Mock mode is active when SMILEID_PARTNER_ID / SMILEID_API_KEY are unset, or
when NIA_MOCK=true is set explicitly.

Usage
-----
    from app.services.nia_adapter import nia_adapter
    result = await nia_adapter.verify("GHA-123456789-0")
    if result.success:
        print(result.full_name, result.dob)
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

_GHA_CARD_RE = re.compile(r"^GHA-\d{9}-\d$")


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class NIAResult:
    success: bool
    id_number: str
    full_name: str = ""
    dob: str = ""          # ISO date YYYY-MM-DD
    gender: str = ""
    # Base64 mugshot from NIA records — held server-side only, never sent to
    # the browser. Cleared from the session cache after face-verify completes.
    photo_b64: str = ""
    raw_response: dict = field(default_factory=dict)
    error_code: str = ""
    error_message: str = ""
    mock: bool = False


# ---------------------------------------------------------------------------
# Provider interface
# ---------------------------------------------------------------------------

class IdentityProvider(ABC):
    @abstractmethod
    async def verify_ghana_card(self, id_number: str, dob: str | None = None) -> NIAResult:
        ...


# ---------------------------------------------------------------------------
# Mock provider
# ---------------------------------------------------------------------------

class MockProvider(IdentityProvider):
    """Simulates NIA responses locally for dev/testing.

    Conventions:
        - id_number ending in "0"  → NOT_FOUND
        - id_number ending in "9"  → TIMEOUT (simulates provider outage)
        - all others              → synthetic success
    """

    async def verify_ghana_card(self, id_number: str, dob: str | None = None) -> NIAResult:
        logger.info("[NIA mock] verifying %s", id_number)
        last = id_number[-1]

        if last == "0":
            return NIAResult(
                success=False,
                id_number=id_number,
                error_code="NOT_FOUND",
                error_message="Ghana Card number not found in the NIA database",
                mock=True,
            )
        if last == "9":
            return NIAResult(
                success=False,
                id_number=id_number,
                error_code="TIMEOUT",
                error_message="NIA verification timed out — please retry",
                mock=True,
            )

        return NIAResult(
            success=True,
            id_number=id_number,
            full_name="KWAME MENSAH",
            dob=dob or "1990-01-15",
            gender="Male",
            photo_b64="",  # mock: no photo
            raw_response={"status": "found", "mock": True},
            mock=True,
        )


# ---------------------------------------------------------------------------
# Smile ID provider
# ---------------------------------------------------------------------------

def _smileid_signature(timestamp: str, partner_id: str, api_key: str) -> str:
    """HMAC-SHA256 signature expected by the Smile ID REST API."""
    msg = (timestamp + partner_id).encode()
    return base64.b64encode(
        hmac.new(api_key.encode(), msg, hashlib.sha256).digest()
    ).decode()


class SmileIDProvider(IdentityProvider):
    """Calls Smile ID's Basic KYC endpoint to look up a Ghana Card.

    Required env vars:
        SMILEID_PARTNER_ID   — numeric partner ID from Smile ID dashboard
        SMILEID_API_KEY      — API key (keep backend-only, never expose)
        SMILEID_ENVIRONMENT  — "sandbox" or "production" (default: sandbox)

    Endpoint: POST https://api.smileidentity.com/v1/id_verification
    Docs: https://docs.smileidentity.com/rest-api/v1/id-api
    """

    # Smile ID uses the same host for sandbox and production; environment
    # is differentiated by the credentials used, not the base URL.
    BASE_URL = "https://api.smileidentity.com/v1"

    def __init__(self) -> None:
        from app.core.config import settings  # late import avoids circular
        self._partner_id = settings.smileid_partner_id
        self._api_key = settings.smileid_api_key
        self._timeout = float(os.getenv("SMILEID_TIMEOUT_SECONDS", "10"))

    async def verify_ghana_card(self, id_number: str, dob: str | None = None) -> NIAResult:
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        sig = _smileid_signature(timestamp, self._partner_id, self._api_key)

        payload: dict = {
            "partner_id": self._partner_id,
            "timestamp": timestamp,
            "signature": sig,
            "country": "GH",
            "id_type": "GHANA_CARD_NO",
            "id_number": id_number,
            "source_sdk": "rest_api",
            "source_sdk_version": "1.0.0",
        }
        if dob:
            payload["dob"] = dob

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(f"{self.BASE_URL}/id_verification", json=payload)
        except httpx.TimeoutException:
            logger.exception("[SmileID] timeout verifying %s", id_number[-4:])
            _alert("smileid_timeout", "Smile ID id_verification timed out", id_number)
            return NIAResult(
                success=False, id_number=id_number,
                error_code="TIMEOUT",
                error_message="Identity service timed out — please retry",
            )
        except Exception:
            logger.exception("[SmileID] network error verifying %s", id_number[-4:])
            _alert("smileid_network_error", "Smile ID network error", id_number)
            return NIAResult(
                success=False, id_number=id_number,
                error_code="NETWORK_ERROR",
                error_message="Unable to reach identity service — please retry later",
            )

        try:
            data = resp.json()
        except Exception:
            logger.error("[SmileID] non-JSON response %s: %s", resp.status_code, resp.text[:200])
            return NIAResult(
                success=False, id_number=id_number,
                error_code="PARSE_ERROR",
                error_message="Unexpected response from identity service",
            )

        # Smile ID returns ResultCode "1012" for a validated ID.
        result_code = str(data.get("ResultCode", ""))
        if result_code == "1012":
            full = data.get("FullData") or data
            return NIAResult(
                success=True,
                id_number=id_number,
                full_name=full.get("FullName", ""),
                dob=full.get("DOB", dob or ""),
                gender=full.get("Gender", ""),
                photo_b64=full.get("Photo", ""),  # base64 mugshot from NIA
                raw_response=data,
            )

        # "1014" = not found; other codes are provider errors.
        if result_code == "1014" or not data.get("found", True):
            return NIAResult(
                success=False, id_number=id_number,
                error_code="NOT_FOUND",
                error_message="Ghana Card number not found. Please check the number and try again.",
                raw_response=data,
            )

        logger.warning("[SmileID] unexpected result code %s for %s", result_code, id_number[-4:])
        return NIAResult(
            success=False, id_number=id_number,
            error_code=result_code or "PROVIDER_ERROR",
            error_message=data.get("ResultText", "Identity verification failed"),
            raw_response=data,
        )


# ---------------------------------------------------------------------------
# Public adapter — wraps the chosen provider with format validation
# ---------------------------------------------------------------------------

def _alert(event: str, msg: str, id_number: str) -> None:
    try:
        from app.services import dev_notifier  # noqa: PLC0415
        dev_notifier.alert(event, msg, {"id_suffix": id_number[-4:] if len(id_number) >= 4 else "****"})
    except Exception:
        pass


def _is_mock_mode() -> bool:
    if os.getenv("NIA_MOCK", "").lower() in {"1", "true", "yes"}:
        return True
    from app.core.config import settings  # noqa: PLC0415
    return not settings.smileid_partner_id or not settings.smileid_api_key


class NIAAdapter:
    """Entry point: validates format then delegates to the active provider."""

    def __init__(self) -> None:
        self._provider: IdentityProvider = (
            MockProvider() if _is_mock_mode() else SmileIDProvider()
        )
        if isinstance(self._provider, MockProvider):
            logger.info("[NIA] running in mock mode (set SMILEID_PARTNER_ID + SMILEID_API_KEY for live)")

    async def verify(self, id_number: str, *, dob: str | None = None) -> NIAResult:
        id_number = (id_number or "").strip().upper()
        if not _GHA_CARD_RE.match(id_number):
            return NIAResult(
                success=False,
                id_number=id_number,
                error_code="INVALID_FORMAT",
                error_message="Ghana Card number must be in the format GHA-XXXXXXXXX-X (e.g. GHA-000000000-0)",
            )
        return await self._provider.verify_ghana_card(id_number, dob=dob)


nia_adapter = NIAAdapter()

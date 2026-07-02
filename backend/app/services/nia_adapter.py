"""NIA Ghana Card verification adapter.

Wraps the National Identification Authority (NIA) API.  In sandbox / mock mode
(NIA_MOCK=true or NIA_API_URL not set) responses are simulated locally so the
rest of the onboarding flow can be exercised without a live NIA subscription.

Usage
-----
    from app.services.nia_adapter import NIAAdapter
    adapter = NIAAdapter()
    result = await adapter.verify(id_number="GHA-123456789-0", dob="1990-01-15")
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from typing import Literal

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_GHA_CARD_RE = re.compile(r"^GHA-\d{9}-\d$")


def _is_mock_mode() -> bool:
    """Return True if NIA calls should be simulated (no live API key / URL)."""
    if os.getenv("NIA_MOCK", "").lower() in {"1", "true", "yes"}:
        return True
    if not os.getenv("NIA_API_URL") or not os.getenv("NIA_API_KEY"):
        return True
    return False


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class NIAResult:
    success: bool
    id_number: str
    full_name: str = ""
    dob: str = ""  # ISO date YYYY-MM-DD as returned by NIA
    gender: str = ""
    photo_url: str = ""  # NIA-hosted mugshot URL (not stored on our side)
    raw_response: dict = field(default_factory=dict)
    error_code: str = ""
    error_message: str = ""
    # Whether this came from mock mode — always logged so audit trail is clear.
    mock: bool = False


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

class NIAAdapter:
    """Thin async wrapper around the NIA identity verification API.

    Instantiate once per request (stateless) or once at app startup.
    """

    def __init__(self) -> None:
        self._mock = _is_mock_mode()
        self._api_url = (os.getenv("NIA_API_URL") or "").rstrip("/")
        self._api_key = os.getenv("NIA_API_KEY", "")
        self._timeout = float(os.getenv("NIA_TIMEOUT_SECONDS", "10"))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def verify(
        self,
        id_number: str,
        *,
        dob: str | None = None,
    ) -> NIAResult:
        """Verify a Ghana Card number against the NIA database.

        Parameters
        ----------
        id_number:
            Ghana Card number in the canonical NIA format ``GHA-XXXXXXXXX-D``.
        dob:
            Optional date of birth (``YYYY-MM-DD``) for secondary matching.

        Returns
        -------
        NIAResult
            Always returns — never raises.  Callers should inspect
            ``result.success`` and ``result.error_code``.
        """
        id_number = (id_number or "").strip().upper()

        if not _GHA_CARD_RE.match(id_number):
            return NIAResult(
                success=False,
                id_number=id_number,
                error_code="INVALID_FORMAT",
                error_message=(
                    "Ghana Card number must be in the format GHA-XXXXXXXXX-D"
                ),
            )

        if self._mock:
            return self._mock_verify(id_number, dob=dob)

        return await self._live_verify(id_number, dob=dob)

    # ------------------------------------------------------------------
    # Mock implementation
    # ------------------------------------------------------------------

    def _mock_verify(self, id_number: str, *, dob: str | None) -> NIAResult:
        """Return a plausible simulated NIA response.

        - Numbers ending in ``0`` are treated as *not found*.
        - All others return a synthetic match.
        """
        logger.info("[NIA mock] verifying %s", id_number)

        last_digit = id_number[-1]
        if last_digit == "0":
            return NIAResult(
                success=False,
                id_number=id_number,
                error_code="NOT_FOUND",
                error_message="Ghana Card number not found in the NIA database",
                mock=True,
            )

        return NIAResult(
            success=True,
            id_number=id_number,
            full_name="KWAME MENSAH",  # uppercase as NIA returns
            dob=dob or "1990-01-15",
            gender="M",
            photo_url="",
            raw_response={"status": "found", "mock": True},
            mock=True,
        )

    # ------------------------------------------------------------------
    # Live implementation
    # ------------------------------------------------------------------

    async def _live_verify(self, id_number: str, *, dob: str | None) -> NIAResult:
        payload: dict = {"id_number": id_number}
        if dob:
            payload["dob"] = dob

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._api_url}/verify",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                )
        except httpx.TimeoutException:
            logger.exception("[NIA] timeout verifying %s", id_number)
            return NIAResult(
                success=False,
                id_number=id_number,
                error_code="TIMEOUT",
                error_message="NIA verification timed out — please retry",
            )
        except Exception:  # noqa: BLE001
            logger.exception("[NIA] unexpected error verifying %s", id_number)
            return NIAResult(
                success=False,
                id_number=id_number,
                error_code="NETWORK_ERROR",
                error_message="Unable to reach the NIA service — please retry later",
            )

        try:
            data = resp.json()
        except Exception:  # noqa: BLE001
            logger.error("[NIA] non-JSON response: %s %s", resp.status_code, resp.text[:200])
            return NIAResult(
                success=False,
                id_number=id_number,
                error_code="PARSE_ERROR",
                error_message="Unexpected response from NIA",
            )

        if resp.status_code == 200 and data.get("found"):
            return NIAResult(
                success=True,
                id_number=id_number,
                full_name=data.get("full_name", ""),
                dob=data.get("dob", dob or ""),
                gender=data.get("gender", ""),
                photo_url=data.get("photo_url", ""),
                raw_response=data,
            )

        if resp.status_code == 404 or not data.get("found"):
            return NIAResult(
                success=False,
                id_number=id_number,
                error_code="NOT_FOUND",
                error_message="Ghana Card number not found in the NIA database",
                raw_response=data,
            )

        return NIAResult(
            success=False,
            id_number=id_number,
            error_code=str(data.get("code", resp.status_code)),
            error_message=data.get("message", "NIA verification failed"),
            raw_response=data,
        )


# ---------------------------------------------------------------------------
# Module-level singleton (import once, reuse across requests)
# ---------------------------------------------------------------------------

nia_adapter = NIAAdapter()

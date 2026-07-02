"""Face liveness + document face-match adapter.

Wraps a third-party face verification service (e.g. Smile Identity, Onfido).
In sandbox / mock mode (FACE_MATCH_MOCK=true or keys not set) results are
simulated locally so the onboarding flow can be tested end-to-end.

The adapter takes:
  - ``selfie_url``  — URL of the live selfie captured during onboarding.
  - ``id_front_url`` — URL of the Ghana Card front image.

It returns a ``FaceMatchResult`` indicating whether the selfie is live
(liveness check) and whether it matches the ID photo (face match).

Usage
-----
    from app.services.face_match_adapter import FaceMatchAdapter
    adapter = FaceMatchAdapter()
    result = await adapter.verify(selfie_url=..., id_front_url=...)
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_mock_mode() -> bool:
    if os.getenv("FACE_MATCH_MOCK", "").lower() in {"1", "true", "yes"}:
        return True
    if not os.getenv("FACE_MATCH_API_URL") or not os.getenv("FACE_MATCH_API_KEY"):
        return True
    return False


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class FaceMatchResult:
    success: bool
    liveness_passed: bool = False
    face_match_passed: bool = False
    confidence_score: float = 0.0  # 0.0–1.0
    raw_response: dict = field(default_factory=dict)
    error_code: str = ""
    error_message: str = ""
    mock: bool = False


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

class FaceMatchAdapter:
    """Async wrapper for face liveness + ID photo matching.

    Instantiate once per request or at app startup.
    """

    LIVENESS_THRESHOLD = float(os.getenv("FACE_LIVENESS_THRESHOLD", "0.85"))
    MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.80"))

    def __init__(self) -> None:
        self._mock = _is_mock_mode()
        self._api_url = (os.getenv("FACE_MATCH_API_URL") or "").rstrip("/")
        self._api_key = os.getenv("FACE_MATCH_API_KEY", "")
        self._timeout = float(os.getenv("FACE_MATCH_TIMEOUT_SECONDS", "15"))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def verify(
        self,
        *,
        selfie_url: str,
        id_front_url: str,
    ) -> FaceMatchResult:
        """Run liveness check on the selfie and match it against the ID photo.

        Both URLs must be publicly accessible (or pre-signed) at call time.

        Returns
        -------
        FaceMatchResult
            Always returns — never raises.  Inspect ``.success``,
            ``.liveness_passed``, and ``.face_match_passed``.
        """
        if not selfie_url or not id_front_url:
            return FaceMatchResult(
                success=False,
                error_code="MISSING_IMAGES",
                error_message="Both selfie_url and id_front_url are required",
            )

        if self._mock:
            return self._mock_verify(selfie_url=selfie_url, id_front_url=id_front_url)

        return await self._live_verify(selfie_url=selfie_url, id_front_url=id_front_url)

    # ------------------------------------------------------------------
    # Mock implementation
    # ------------------------------------------------------------------

    def _mock_verify(self, *, selfie_url: str, id_front_url: str) -> FaceMatchResult:
        """Simulate a successful face verification result.

        To simulate failure in tests, set ``FACE_MATCH_MOCK_FAIL=true``.
        """
        logger.info("[FaceMatch mock] verifying selfie=%s id=%s", selfie_url[:60], id_front_url[:60])

        if os.getenv("FACE_MATCH_MOCK_FAIL", "").lower() in {"1", "true", "yes"}:
            return FaceMatchResult(
                success=False,
                liveness_passed=False,
                face_match_passed=False,
                confidence_score=0.0,
                error_code="FACE_MISMATCH",
                error_message="Face does not match the ID document (mock failure)",
                mock=True,
            )

        return FaceMatchResult(
            success=True,
            liveness_passed=True,
            face_match_passed=True,
            confidence_score=0.97,
            raw_response={"status": "matched", "mock": True, "confidence": 0.97},
            mock=True,
        )

    # ------------------------------------------------------------------
    # Live implementation
    # ------------------------------------------------------------------

    async def _live_verify(self, *, selfie_url: str, id_front_url: str) -> FaceMatchResult:
        payload = {
            "selfie_url": selfie_url,
            "id_front_url": id_front_url,
            "liveness_threshold": self.LIVENESS_THRESHOLD,
            "match_threshold": self.MATCH_THRESHOLD,
        }

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
            logger.exception("[FaceMatch] timeout")
            # G30: alert dev team on face-match API failure
            from app.services import dev_notifier  # noqa: PLC0415
            dev_notifier.alert("face_match_timeout", "Face verification service timed out", {})
            return FaceMatchResult(
                success=False,
                error_code="TIMEOUT",
                error_message="Face verification timed out — please retry",
            )
        except Exception:  # noqa: BLE001
            logger.exception("[FaceMatch] unexpected network error")
            from app.services import dev_notifier  # noqa: PLC0415
            dev_notifier.alert("face_match_network_error", "Face verification network error", {})
            return FaceMatchResult(
                success=False,
                error_code="NETWORK_ERROR",
                error_message="Unable to reach face verification service — please retry later",
            )

        try:
            data = resp.json()
        except Exception:  # noqa: BLE001
            logger.error("[FaceMatch] non-JSON response: %s %s", resp.status_code, resp.text[:200])
            from app.services import dev_notifier  # noqa: PLC0415
            dev_notifier.alert(
                "face_match_parse_error",
                "Face verification returned non-JSON response",
                {"status_code": resp.status_code},
            )
            return FaceMatchResult(
                success=False,
                error_code="PARSE_ERROR",
                error_message="Unexpected response from face verification service",
            )

        if resp.status_code != 200:
            return FaceMatchResult(
                success=False,
                error_code=str(data.get("code", resp.status_code)),
                error_message=data.get("message", "Face verification failed"),
                raw_response=data,
            )

        liveness_passed = bool(data.get("liveness_passed", False))
        face_match_passed = bool(data.get("face_match_passed", False))
        confidence_score = float(data.get("confidence_score", 0.0))
        overall_success = liveness_passed and face_match_passed

        if not liveness_passed:
            error_message = "Liveness check failed — please retake your selfie in good lighting"
        elif not face_match_passed:
            error_message = f"Face does not match the ID document (confidence: {confidence_score:.0%})"
        else:
            error_message = ""

        return FaceMatchResult(
            success=overall_success,
            liveness_passed=liveness_passed,
            face_match_passed=face_match_passed,
            confidence_score=confidence_score,
            raw_response=data,
            error_code="" if overall_success else "FACE_MISMATCH",
            error_message=error_message,
        )


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

face_match_adapter = FaceMatchAdapter()

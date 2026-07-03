"""Face liveness + face-match adapter — Smile ID backend.

Accepts a live selfie captured by @smile_id/smart-camera-web (base64, liveness
already enforced by the SDK) and a reference photo (base64 NIA mugshot from the
Ghana Card lookup step).

Provider interface: FaceMatchProvider.compare(selfie_b64, reference_b64)
Implementations:
  • SmileIDFaceProvider  — calls api.smileidentity.com/v1/compare
  • MockFaceProvider     — local simulation

Mock mode is active when SMILEID_PARTNER_ID / SMILEID_API_KEY are not set, or
when FACE_MATCH_MOCK=true.

Usage
-----
    from app.services.face_match_adapter import face_match_adapter
    result = await face_match_adapter.verify(selfie_b64=..., reference_b64=...)
    if result.success:
        print(f"Confidence: {result.confidence_score:.0%}")
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class FaceMatchResult:
    success: bool
    liveness_passed: bool = False
    face_match_passed: bool = False
    confidence_score: float = 0.0   # 0.0–1.0
    raw_response: dict = field(default_factory=dict)
    error_code: str = ""
    error_message: str = ""
    mock: bool = False


# ---------------------------------------------------------------------------
# Provider interface
# ---------------------------------------------------------------------------

class FaceMatchProvider(ABC):
    @abstractmethod
    async def compare(self, selfie_b64: str, reference_b64: str) -> FaceMatchResult:
        ...


# ---------------------------------------------------------------------------
# Mock provider
# ---------------------------------------------------------------------------

class MockFaceProvider(FaceMatchProvider):
    """Returns a configurable result with no network calls.

    Set FACE_MATCH_MOCK_FAIL=true to simulate failure.
    Set FACE_MATCH_MOCK_LIVENESS_FAIL=true to simulate liveness-only failure.
    """

    async def compare(self, selfie_b64: str, reference_b64: str) -> FaceMatchResult:
        logger.info("[FaceMatch mock] comparing faces")

        if os.getenv("FACE_MATCH_MOCK_LIVENESS_FAIL", "").lower() in {"1", "true", "yes"}:
            return FaceMatchResult(
                success=False,
                liveness_passed=False,
                face_match_passed=False,
                confidence_score=0.0,
                error_code="LIVENESS_FAIL",
                error_message="Liveness check failed — please retake your selfie in good lighting",
                mock=True,
            )

        if os.getenv("FACE_MATCH_MOCK_FAIL", "").lower() in {"1", "true", "yes"}:
            return FaceMatchResult(
                success=False,
                liveness_passed=True,
                face_match_passed=False,
                confidence_score=0.42,
                error_code="FACE_MISMATCH",
                error_message="Face does not match the Ghana Card record (confidence: 42%)",
                mock=True,
            )

        return FaceMatchResult(
            success=True,
            liveness_passed=True,
            face_match_passed=True,
            confidence_score=0.97,
            raw_response={"status": "matched", "mock": True, "confidence": 97},
            mock=True,
        )


# ---------------------------------------------------------------------------
# Smile ID provider
# ---------------------------------------------------------------------------

def _smileid_signature(timestamp: str, partner_id: str, api_key: str) -> str:
    msg = (timestamp + partner_id).encode()
    return base64.b64encode(
        hmac.new(api_key.encode(), msg, hashlib.sha256).digest()
    ).decode()


class SmileIDFaceProvider(FaceMatchProvider):
    """Compares a live selfie against a reference photo via Smile ID.

    Uses Smile ID's face compare endpoint:
    POST https://api.smileidentity.com/v1/compare

    image_type_id values (Smile ID spec):
        0 = SELFIE (live, from SmartSelfie SDK)
        3 = ID_CARD_FACE (reference photo from NIA lookup)

    Docs: https://docs.smileidentity.com/rest-api/v1/face-compare
    """

    BASE_URL = "https://api.smileidentity.com/v1"
    LIVENESS_THRESHOLD = float(os.getenv("SMILEID_LIVENESS_THRESHOLD", "0.85"))
    MATCH_THRESHOLD = float(os.getenv("SMILEID_MATCH_THRESHOLD", "0.85"))

    def __init__(self) -> None:
        from app.core.config import settings  # noqa: PLC0415
        self._partner_id = settings.smileid_partner_id
        self._api_key = settings.smileid_api_key
        self._timeout = float(os.getenv("SMILEID_FACE_TIMEOUT_SECONDS", "15"))

    async def compare(self, selfie_b64: str, reference_b64: str) -> FaceMatchResult:
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        sig = _smileid_signature(timestamp, self._partner_id, self._api_key)

        payload = {
            "partner_id": self._partner_id,
            "timestamp": timestamp,
            "signature": sig,
            "images": [
                {"image_type_id": 0, "image": selfie_b64},      # live selfie
                {"image_type_id": 3, "image": reference_b64},   # NIA ID photo
            ],
            "source_sdk": "rest_api",
            "source_sdk_version": "1.0.0",
        }

        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(f"{self.BASE_URL}/compare", json=payload)
        except httpx.TimeoutException:
            logger.exception("[SmileID face] timeout")
            _alert("smileid_face_timeout", "Smile ID face compare timed out")
            return FaceMatchResult(
                success=False,
                error_code="TIMEOUT",
                error_message="Face verification timed out — please retry",
            )
        except Exception:
            logger.exception("[SmileID face] network error")
            _alert("smileid_face_network_error", "Smile ID face compare network error")
            return FaceMatchResult(
                success=False,
                error_code="NETWORK_ERROR",
                error_message="Unable to reach face verification service — please retry later",
            )

        try:
            data = resp.json()
        except Exception:
            logger.error("[SmileID face] non-JSON %s: %s", resp.status_code, resp.text[:200])
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

        # Smile ID returns ConfidenceValue as 0–100; normalise to 0.0–1.0.
        raw_confidence = float(data.get("ConfidenceValue", 0))
        confidence = raw_confidence / 100.0 if raw_confidence > 1 else raw_confidence

        actions = data.get("Actions", {})
        liveness_action = actions.get("Liveness_Check", "")
        face_action = actions.get("Selfie_To_ID_Face_Comparison", "")

        liveness_passed = liveness_action == "Passed" or confidence >= self.LIVENESS_THRESHOLD
        face_match_passed = face_action == "Passed" or confidence >= self.MATCH_THRESHOLD
        overall = liveness_passed and face_match_passed

        if not liveness_passed:
            err = "Liveness check failed — please ensure your face is clearly visible and retry"
            code = "LIVENESS_FAIL"
        elif not face_match_passed:
            err = f"Face does not match the Ghana Card record (confidence: {confidence:.0%})"
            code = "FACE_MISMATCH"
        else:
            err = ""
            code = ""

        return FaceMatchResult(
            success=overall,
            liveness_passed=liveness_passed,
            face_match_passed=face_match_passed,
            confidence_score=confidence,
            raw_response=data,
            error_code=code,
            error_message=err,
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _alert(event: str, msg: str) -> None:
    try:
        from app.services import dev_notifier  # noqa: PLC0415
        dev_notifier.alert(event, msg, {})
    except Exception:
        pass


def _is_mock_mode() -> bool:
    if os.getenv("FACE_MATCH_MOCK", "").lower() in {"1", "true", "yes"}:
        return True
    from app.core.config import settings  # noqa: PLC0415
    return not settings.smileid_partner_id or not settings.smileid_api_key


# ---------------------------------------------------------------------------
# Public adapter
# ---------------------------------------------------------------------------

class FaceMatchAdapter:
    """Entry point — validates inputs then delegates to the active provider."""

    def __init__(self) -> None:
        self._provider: FaceMatchProvider = (
            MockFaceProvider() if _is_mock_mode() else SmileIDFaceProvider()
        )
        if isinstance(self._provider, MockFaceProvider):
            logger.info("[FaceMatch] running in mock mode")

    async def verify(self, *, selfie_b64: str, reference_b64: str) -> FaceMatchResult:
        """Compare a live selfie against a reference photo.

        Both arguments are base64-encoded image data (no data-URI prefix needed,
        but the adapter strips ``data:image/...;base64,`` if present).
        """
        selfie_b64 = _strip_data_uri(selfie_b64 or "")
        reference_b64 = _strip_data_uri(reference_b64 or "")

        if not selfie_b64:
            return FaceMatchResult(
                success=False,
                error_code="MISSING_SELFIE",
                error_message="Selfie image is required",
            )

        # When the mock has no NIA photo, skip comparison and rely on liveness only.
        if not reference_b64 and isinstance(self._provider, MockFaceProvider):
            return await self._provider.compare(selfie_b64, "")

        if not reference_b64:
            return FaceMatchResult(
                success=False,
                error_code="MISSING_REFERENCE",
                error_message="Reference photo not available — please restart identity verification",
            )

        return await self._provider.compare(selfie_b64, reference_b64)


def _strip_data_uri(s: str) -> str:
    if "base64," in s:
        return s.split("base64,", 1)[1]
    return s


face_match_adapter = FaceMatchAdapter()

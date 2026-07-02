"""Logistics / shipping adapter.

Wraps a third-party logistics provider API (e.g. Sendy, DHL Express Ghana,
GIG Logistics).  In sandbox / mock mode (LOGISTICS_MOCK=true or keys not set)
all responses are simulated so checkout can be tested without a live carrier
subscription.

The adapter exposes:
  - ``get_rate``       — estimate shipping cost and delivery days.
  - ``create_shipment`` — book a shipment, return tracking number + label URL.
  - ``get_tracking``   — fetch the current tracking status of a shipment.

A webhook handler verifies inbound carrier webhooks and normalises them into
the platform's canonical delivery-event format.

Usage
-----
    from app.services.logistics_adapter import logistics_adapter
    rate = await logistics_adapter.get_rate(origin=..., destination=..., weight_kg=0.5)
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
from dataclasses import dataclass, field
from decimal import Decimal

import httpx

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_mock_mode() -> bool:
    if os.getenv("LOGISTICS_MOCK", "").lower() in {"1", "true", "yes"}:
        return True
    if not os.getenv("LOGISTICS_API_URL") or not os.getenv("LOGISTICS_API_KEY"):
        return True
    return False


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class ShippingAddress:
    full_name: str
    address_line1: str
    city: str
    state: str
    country: str = "Ghana"
    postal_code: str = ""
    phone: str = ""


@dataclass
class ShippingRate:
    service_code: str
    service_name: str
    cost_ghs: Decimal
    estimated_days: int
    carrier: str
    mock: bool = False


@dataclass
class Shipment:
    tracking_number: str
    carrier: str
    label_url: str
    estimated_days: int
    cost_ghs: Decimal
    raw_response: dict = field(default_factory=dict)
    mock: bool = False


@dataclass
class TrackingEvent:
    timestamp: str  # ISO-8601
    status: str     # e.g. "in_transit", "delivered", "out_for_delivery"
    location: str
    description: str


@dataclass
class TrackingResult:
    tracking_number: str
    carrier: str
    current_status: str
    events: list[TrackingEvent] = field(default_factory=list)
    mock: bool = False
    error_code: str = ""
    error_message: str = ""


# Canonical delivery event types (mapped from carrier-specific codes).
DELIVERY_EVENTS = {
    "pre_transit",       # label created, not yet picked up
    "in_transit",        # en route
    "out_for_delivery",  # final leg
    "delivered",         # handed to recipient
    "failed_attempt",    # nobody home
    "returned",          # shipment returned to sender
    "exception",         # customs hold / damage / loss
}


# ---------------------------------------------------------------------------
# Adapter
# ---------------------------------------------------------------------------

class LogisticsAdapter:
    """Async wrapper for the logistics / shipping API."""

    # Default Ghana standard rates (GHS) used in mock mode.
    _MOCK_STANDARD_RATE = Decimal("15.00")
    _MOCK_EXPRESS_RATE = Decimal("30.00")
    _MOCK_PICKUP_RATE = Decimal("5.00")

    def __init__(self) -> None:
        self._mock = _is_mock_mode()
        self._api_url = (os.getenv("LOGISTICS_API_URL") or "").rstrip("/")
        self._api_key = os.getenv("LOGISTICS_API_KEY", "")
        self._webhook_secret = os.getenv("LOGISTICS_WEBHOOK_SECRET", "")
        self._timeout = float(os.getenv("LOGISTICS_TIMEOUT_SECONDS", "10"))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def get_rate(
        self,
        *,
        origin: ShippingAddress,
        destination: ShippingAddress,
        weight_kg: float = 0.5,
        service: str = "standard",
    ) -> list[ShippingRate]:
        """Return a list of available shipping rates for the given route.

        Always returns at least a ``standard`` option.  May return
        ``express`` and ``pickup`` depending on carrier coverage.
        """
        if self._mock:
            return self._mock_rates(destination=destination, service=service)
        return await self._live_rates(
            origin=origin, destination=destination, weight_kg=weight_kg
        )

    async def create_shipment(
        self,
        *,
        order_id: str,
        origin: ShippingAddress,
        destination: ShippingAddress,
        weight_kg: float = 0.5,
        service_code: str = "standard",
        description: str = "Spree marketplace order",
    ) -> Shipment:
        """Book a shipment and return tracking details."""
        if self._mock:
            return self._mock_shipment(order_id=order_id, service_code=service_code)
        return await self._live_create_shipment(
            order_id=order_id,
            origin=origin,
            destination=destination,
            weight_kg=weight_kg,
            service_code=service_code,
            description=description,
        )

    async def get_tracking(self, tracking_number: str, carrier: str = "") -> TrackingResult:
        """Fetch the current tracking status for a shipment."""
        if self._mock:
            return self._mock_tracking(tracking_number=tracking_number)
        return await self._live_tracking(tracking_number=tracking_number, carrier=carrier)

    def verify_webhook(self, payload: bytes, signature: str) -> bool:
        """Verify an inbound carrier webhook using HMAC-SHA256.

        Returns True if the signature matches and the webhook should be trusted.
        """
        if not self._webhook_secret:
            logger.warning("[logistics] LOGISTICS_WEBHOOK_SECRET not set — accepting webhook (mock/dev mode)")
            return True
        expected = hmac.new(
            self._webhook_secret.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    def parse_webhook(self, data: dict) -> dict:
        """Normalise a carrier webhook payload into a canonical event dict.

        Returns::
            {
                "tracking_number": str,
                "status": str,   # one of DELIVERY_EVENTS
                "timestamp": str,
                "location": str,
                "description": str,
                "raw": dict,
            }
        """
        # Carrier-specific mapping goes here.  Default pass-through for now.
        status = data.get("status", "in_transit")
        if status not in DELIVERY_EVENTS:
            status = "in_transit"
        return {
            "tracking_number": data.get("tracking_number", ""),
            "status": status,
            "timestamp": data.get("timestamp", ""),
            "location": data.get("location", ""),
            "description": data.get("description", ""),
            "raw": data,
        }

    # ------------------------------------------------------------------
    # Mock implementations
    # ------------------------------------------------------------------

    def _mock_rates(self, *, destination: ShippingAddress, service: str) -> list[ShippingRate]:
        logger.info("[logistics mock] get_rate to %s %s", destination.city, destination.country)
        return [
            ShippingRate(
                service_code="standard",
                service_name="Standard Delivery (3-5 days)",
                cost_ghs=self._MOCK_STANDARD_RATE,
                estimated_days=4,
                carrier="Spree Logistics",
                mock=True,
            ),
            ShippingRate(
                service_code="express",
                service_name="Express Delivery (1-2 days)",
                cost_ghs=self._MOCK_EXPRESS_RATE,
                estimated_days=1,
                carrier="Spree Logistics",
                mock=True,
            ),
            ShippingRate(
                service_code="pickup",
                service_name="Store Pickup",
                cost_ghs=self._MOCK_PICKUP_RATE,
                estimated_days=0,
                carrier="Spree Logistics",
                mock=True,
            ),
        ]

    def _mock_shipment(self, *, order_id: str, service_code: str) -> Shipment:
        tracking = f"MOCK-{order_id[-8:].upper()}"
        logger.info("[logistics mock] create_shipment order=%s tracking=%s", order_id, tracking)
        rate_map = {
            "express": self._MOCK_EXPRESS_RATE,
            "pickup": self._MOCK_PICKUP_RATE,
        }
        days_map = {"express": 1, "pickup": 0}
        return Shipment(
            tracking_number=tracking,
            carrier="Spree Logistics (Mock)",
            label_url=f"https://mock.spree.gh/labels/{tracking}.pdf",
            estimated_days=days_map.get(service_code, 4),
            cost_ghs=rate_map.get(service_code, self._MOCK_STANDARD_RATE),
            raw_response={"mock": True, "order_id": order_id},
            mock=True,
        )

    def _mock_tracking(self, *, tracking_number: str) -> TrackingResult:
        logger.info("[logistics mock] get_tracking %s", tracking_number)
        return TrackingResult(
            tracking_number=tracking_number,
            carrier="Spree Logistics (Mock)",
            current_status="in_transit",
            events=[
                TrackingEvent(
                    timestamp="2026-07-01T08:00:00Z",
                    status="pre_transit",
                    location="Accra Hub",
                    description="Package collected from seller",
                ),
                TrackingEvent(
                    timestamp="2026-07-01T14:00:00Z",
                    status="in_transit",
                    location="Tema Sorting Centre",
                    description="En route to destination",
                ),
            ],
            mock=True,
        )

    # ------------------------------------------------------------------
    # Live implementations
    # ------------------------------------------------------------------

    async def _live_rates(
        self,
        *,
        origin: ShippingAddress,
        destination: ShippingAddress,
        weight_kg: float,
    ) -> list[ShippingRate]:
        payload = {
            "origin": {
                "city": origin.city,
                "state": origin.state,
                "country": origin.country,
                "postal_code": origin.postal_code,
            },
            "destination": {
                "city": destination.city,
                "state": destination.state,
                "country": destination.country,
                "postal_code": destination.postal_code,
            },
            "weight_kg": weight_kg,
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._api_url}/rates",
                    json=payload,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                )
            data = resp.json()
        except Exception:  # noqa: BLE001
            logger.exception("[logistics] get_rate failed")
            return self._mock_rates(destination=destination, service="standard")

        return [
            ShippingRate(
                service_code=r.get("service_code", "standard"),
                service_name=r.get("service_name", "Standard"),
                cost_ghs=Decimal(str(r.get("cost", 15))),
                estimated_days=int(r.get("estimated_days", 4)),
                carrier=r.get("carrier", ""),
            )
            for r in data.get("rates", [])
        ]

    async def _live_create_shipment(
        self,
        *,
        order_id: str,
        origin: ShippingAddress,
        destination: ShippingAddress,
        weight_kg: float,
        service_code: str,
        description: str,
    ) -> Shipment:
        payload = {
            "order_id": order_id,
            "service_code": service_code,
            "origin": {
                "full_name": origin.full_name,
                "address_line1": origin.address_line1,
                "city": origin.city,
                "state": origin.state,
                "country": origin.country,
                "phone": origin.phone,
            },
            "destination": {
                "full_name": destination.full_name,
                "address_line1": destination.address_line1,
                "city": destination.city,
                "state": destination.state,
                "country": destination.country,
                "phone": destination.phone,
            },
            "weight_kg": weight_kg,
            "description": description,
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._api_url}/shipments",
                    json=payload,
                    headers={"Authorization": f"Bearer {self._api_key}"},
                )
            data = resp.json()
        except Exception:  # noqa: BLE001
            logger.exception("[logistics] create_shipment failed — falling back to mock")
            return self._mock_shipment(order_id=order_id, service_code=service_code)

        return Shipment(
            tracking_number=data.get("tracking_number", ""),
            carrier=data.get("carrier", ""),
            label_url=data.get("label_url", ""),
            estimated_days=int(data.get("estimated_days", 4)),
            cost_ghs=Decimal(str(data.get("cost", 15))),
            raw_response=data,
        )

    async def _live_tracking(self, *, tracking_number: str, carrier: str) -> TrackingResult:
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(
                    f"{self._api_url}/tracking/{tracking_number}",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                )
            data = resp.json()
        except Exception:  # noqa: BLE001
            logger.exception("[logistics] get_tracking failed")
            return TrackingResult(
                tracking_number=tracking_number,
                carrier=carrier,
                current_status="unknown",
                error_code="NETWORK_ERROR",
                error_message="Unable to reach logistics service",
            )

        events = [
            TrackingEvent(
                timestamp=e.get("timestamp", ""),
                status=e.get("status", "in_transit"),
                location=e.get("location", ""),
                description=e.get("description", ""),
            )
            for e in data.get("events", [])
        ]
        return TrackingResult(
            tracking_number=tracking_number,
            carrier=data.get("carrier", carrier),
            current_status=data.get("current_status", "unknown"),
            events=events,
        )


# ---------------------------------------------------------------------------
# Module-level singleton
# ---------------------------------------------------------------------------

logistics_adapter = LogisticsAdapter()

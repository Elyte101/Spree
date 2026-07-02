"""
Paystack API wrapper using stdlib urllib only — no extra deps.

All amounts are in the smallest currency unit:
  $ → pesewas (1 $ = 100 pesewas)
  USD → cents    (1 USD = 100 cents)
"""

import hashlib
import hmac
import json
import logging
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import settings

logger = logging.getLogger(__name__)

_BASE = "https://api.paystack.co"


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.paystack_secret_key}",
        "Content-Type": "application/json",
    }


def _request(method: str, path: str, body: dict | None = None) -> dict:
    url = f"{_BASE}{path}"
    data = json.dumps(body).encode() if body else None
    req = Request(url, data=data, headers=_headers(), method=method)
    try:
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except HTTPError as exc:
        raw = exc.read()
        try:
            detail = json.loads(raw).get("message", str(exc))
        except Exception:
            detail = str(exc)
        logger.error("Paystack %s %s → %s: %s", method, path, exc.code, detail)
        raise RuntimeError(f"Paystack error: {detail}") from exc
    except URLError as exc:
        logger.error("Paystack network error: %s", exc)
        raise RuntimeError("Could not reach Paystack. Check your internet connection.") from exc


def initialize_transaction(
    amount_minor: int,
    email: str,
    reference: str,
    currency: str = "GHS",
    callback_url: str = "",
    channels: list[str] | None = None,
) -> dict:
    """Create a Paystack transaction. Returns {"authorization_url", "access_code", "reference"}."""
    payload: dict = {
        "amount": amount_minor,
        "email": email,
        "reference": reference,
        "currency": currency,
    }
    if callback_url:
        payload["callback_url"] = callback_url
    if channels:
        payload["channels"] = channels
    result = _request("POST", "/transaction/initialize", payload)
    return result.get("data", {})


def verify_transaction(reference: str) -> dict:
    """Verify a transaction. Returns the full transaction data dict."""
    result = _request("GET", f"/transaction/verify/{reference}")
    return result.get("data", {})


def create_transfer_recipient(
    name: str,
    account_number: str,
    bank_code: str = "",
    mobile_money_network: str = "",
    currency: str = "GHS",
) -> str:
    """Create a Paystack transfer recipient. Returns the recipient_code."""
    if mobile_money_network:
        payload = {
            "type": "mobile_money",
            "name": name,
            "account_number": account_number,
            "bank_code": mobile_money_network,
            "currency": currency,
        }
    else:
        payload = {
            "type": "ghipss" if currency == "$" else "nuban",
            "name": name,
            "account_number": account_number,
            "bank_code": bank_code,
            "currency": currency,
        }
    result = _request("POST", "/transferrecipient", payload)
    return result.get("data", {}).get("recipient_code", "")


def initiate_transfer(
    amount_minor: int,
    recipient_code: str,
    reason: str = "",
    idempotency_key: str = "",
) -> dict:
    """Send money to a recipient. Returns transfer data dict.

    idempotency_key (G29): pass a stable per-transfer key so Paystack deduplicates
    retries — prevents double-paying a vendor if the first call times out.
    """
    payload: dict = {
        "source": "balance",
        "amount": amount_minor,
        "recipient": recipient_code,
        "reason": reason,
    }
    if idempotency_key:
        payload["reference"] = idempotency_key
    result = _request("POST", "/transfer", payload)
    return result.get("data", {})


def refund_transaction(reference: str, amount_minor: int | None = None) -> dict:
    """Issue a full or partial refund. Returns refund data dict."""
    payload: dict = {"transaction": reference}
    if amount_minor is not None:
        payload["amount"] = amount_minor
    result = _request("POST", "/refund", payload)
    return result.get("data", {})


def charge(
    amount_minor: int,
    email: str,
    reference: str,
    currency: str = "GHS",
    mobile_money: dict | None = None,
) -> dict:
    """Initiate a direct charge via Paystack Charge API. Returns the charge data dict."""
    payload: dict = {
        "amount": amount_minor,
        "email": email,
        "reference": reference,
        "currency": currency,
    }
    if mobile_money:
        payload["mobile_money"] = mobile_money
    result = _request("POST", "/charge", payload)
    return result.get("data", {})


def submit_otp(otp: str, reference: str) -> dict:
    """Submit OTP for a pending MoMo charge. Returns updated charge data."""
    result = _request("POST", "/charge/submit_otp", {"otp": otp, "reference": reference})
    return result.get("data", {})


def check_charge(reference: str) -> dict:
    """Poll the current status of a pending charge. Returns charge data dict."""
    result = _request("GET", f"/charge/{reference}")
    return result.get("data", {})


def verify_webhook_signature(payload_bytes: bytes, signature: str) -> bool:
    """Return True if the webhook signature matches the secret key."""
    if not settings.paystack_secret_key:
        return False
    computed = hmac.new(
        settings.paystack_secret_key.encode(),
        payload_bytes,
        hashlib.sha512,
    ).hexdigest()
    return hmac.compare_digest(computed, signature)

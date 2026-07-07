"""
Paystack API wrapper — uses httpx so Cloudflare's bot filter (error 1010)
doesn't block outbound requests due to a missing or default User-Agent.

All amounts are in the smallest currency unit:
  GHS → pesewas (1 GHS = 100 pesewas)
  USD → cents    (1 USD = 100 cents)
"""

import hashlib
import hmac
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_BASE = "https://api.paystack.co"

# A real User-Agent is required: Cloudflare blocks requests with the default
# Python-urllib or Node user-agents with error code 1010 (browser integrity check).
_UA = "Spree/1.0 (+https://spreecommerce.vercel.app)"

# Shared client — connection-pooled, default headers applied to every request.
# Authorization is injected per-request (it reads from settings at call time).
_http = httpx.Client(
    base_url=_BASE,
    headers={
        "User-Agent": _UA,
        "Accept": "application/json",
        "Content-Type": "application/json",
    },
    timeout=15.0,
)


class PaystackAPIError(RuntimeError):
    """Non-2xx response from Paystack. Carries the original HTTP status code."""

    def __init__(self, http_status: int, message: str, provider_message: str = "") -> None:
        super().__init__(message)
        self.http_status = http_status
        self.provider_message = provider_message


def _request(method: str, path: str, body: dict | None = None) -> dict:
    try:
        resp = _http.request(
            method,
            path,
            **({"json": body} if body is not None else {}),
            headers={"Authorization": f"Bearer {settings.paystack_secret_key}"},
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as exc:
        raw_text = exc.response.text
        try:
            parsed = exc.response.json()
            ps_status = parsed.get("status", "")
            provider_message = parsed.get("message") or raw_text
        except Exception:
            ps_status = ""
            provider_message = raw_text or f"HTTP {exc.response.status_code}"
        logger.error(
            "Paystack %s %s → HTTP %s | status=%r message=%r",
            method, path, exc.response.status_code, ps_status, provider_message,
        )
        raise PaystackAPIError(
            exc.response.status_code,
            f"Paystack error: {provider_message}",
            provider_message,
        ) from exc
    except httpx.RequestError as exc:
        logger.error("Paystack network error %s %s: %s", method, path, exc)
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
            "type": "ghipss" if currency == "GHS" else "nuban",
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


_MOMO_BANK_CODE: dict[str, str] = {
    "mtn mobile money": "MTN",
    "telecel cash": "VOD",
    "airteltigo money": "ATL",
}


def resolve_momo_account(phone: str, network: str) -> str:
    """Return the account name for a Ghana MoMo number via Paystack /bank/resolve.

    Raises PaystackAPIError on HTTP errors, RuntimeError on network failure, and
    ValueError for unsupported networks.  Callers should catch and surface gracefully.
    """
    bank_code = _MOMO_BANK_CODE.get(network.strip().lower())
    if not bank_code:
        raise ValueError(f"Unsupported MoMo network: {network!r}")

    # Normalise +233XXXXXXXXX → 0XXXXXXXXX
    acct = phone.strip()
    if acct.startswith("+233"):
        acct = "0" + acct[4:]

    result = _request("GET", f"/bank/resolve?account_number={acct}&bank_code={bank_code}")
    name: str = (result.get("data") or {}).get("account_name", "")
    if not name:
        raise PaystackAPIError(200, "Account name not returned by Paystack", "")
    return name


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

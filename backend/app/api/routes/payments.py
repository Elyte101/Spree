import json
import logging

from fastapi import APIRouter, Body, Header, HTTPException, Query, Request, status
from pydantic import BaseModel

from app.api.deps import ActorRole, DBSession, InternalAPIKey
from app.schemas.order import ChargeMomoIn, ChargeMomoOut, OrderCreateIn, PaymentInitOut, PaymentVerifyOut, SubmitOtpIn
from app.services.orders import (
    charge_momo_payment,
    check_momo_charge,
    handle_paystack_webhook,
    initialize_payment,
    refund_order,
    submit_otp_for_order,
    verify_payment,
)
from app.services import paystack as paystack_svc
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/orders/initialize-payment", response_model=PaymentInitOut, status_code=status.HTTP_201_CREATED)
def payment_initialize(
    payload: OrderCreateIn,
    db: DBSession,
    _: InternalAPIKey,
    callback_url: str = Query(default=""),
):
    return initialize_payment(db, payload, callback_url)


@router.get("/orders/verify-payment", response_model=PaymentVerifyOut)
def payment_verify(
    reference: str = Query(..., min_length=1),
    db: DBSession = ...,
    _: InternalAPIKey = ...,
):
    order_dict = verify_payment(db, reference)
    return {"orderId": order_dict["id"], "status": order_dict["status"]}


@router.post("/webhooks/paystack", status_code=status.HTTP_200_OK)
async def paystack_webhook(
    request: Request,
    db: DBSession,
    _: InternalAPIKey,
    x_paystack_signature: str = Header(default=""),
):
    body = await request.body()

    if not settings.payments_mock:
        if not paystack_svc.verify_webhook_signature(body, x_paystack_signature):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
    else:
        logger.warning(
            "paystack_webhook_unverified: PAYMENTS_MOCK=true — "
            "skipping webhook signature check (dev mode only)."
        )

    try:
        event_data = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    event = event_data.get("event", "")
    data = event_data.get("data", {})
    logger.info("Paystack webhook received: %s", event)
    handle_paystack_webhook(db, event, data)
    return {"received": True}


class MomoResolveIn(BaseModel):
    number: str
    network: str


@router.post("/momo/resolve")
def momo_resolve(payload: MomoResolveIn, _: InternalAPIKey):
    """Resolve a Ghana MoMo account name via Paystack.

    Returns {"resolved": true, "name": "..."} on success.
    Returns HTTP 424 when Paystack cannot find the account (wrong number/network).
    Returns HTTP 503 when Paystack is not configured.
    """
    if not settings.paystack_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Account name resolution is not available right now.",
        )
    try:
        name = paystack_svc.resolve_momo_account(payload.number, payload.network)
        return {"resolved": True, "name": name}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except paystack_svc.PaystackAPIError as exc:
        logger.warning("momo_resolve: Paystack error %s: %s", exc.http_status, exc)
        raise HTTPException(
            status_code=status.HTTP_424_FAILED_DEPENDENCY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.error("momo_resolve: unexpected error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach account verification service.",
        ) from exc


@router.post("/orders/charge-momo", response_model=ChargeMomoOut, status_code=status.HTTP_201_CREATED)
def momo_charge(payload: ChargeMomoIn, db: DBSession, _: InternalAPIKey):
    return charge_momo_payment(db, payload)


@router.post("/orders/submit-otp", status_code=status.HTTP_200_OK)
def otp_submit(payload: SubmitOtpIn, db: DBSession, _: InternalAPIKey):
    return submit_otp_for_order(db, payload.otp, payload.reference)


@router.get("/orders/check-charge", status_code=status.HTTP_200_OK)
def charge_check(reference: str = Query(..., min_length=1), _: InternalAPIKey = ...):
    return check_momo_charge(reference)


@router.post("/orders/{order_id}/refund", status_code=status.HTTP_200_OK)
def order_refund(
    order_id: str,
    db: DBSession,
    _: InternalAPIKey,
    actor_role: ActorRole,
):
    # A2: actor_role comes from the verified signed actor token (deps.py),
    # not a raw X-Actor-Role header — a raw header here would let anyone
    # with the internal key self-declare "admin" and refund any order.
    if actor_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return refund_order(db, order_id)

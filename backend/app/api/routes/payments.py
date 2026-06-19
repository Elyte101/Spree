import json
import logging

from fastapi import APIRouter, Header, HTTPException, Query, Request, status

from app.api.deps import DBSession, InternalAPIKey
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

    if settings.paystack_secret_key:
        if not paystack_svc.verify_webhook_signature(body, x_paystack_signature):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
    else:
        logger.warning(
            "paystack_webhook_unverified: PAYSTACK_SECRET_KEY is not set — "
            "skipping signature check. Set the key before going to production."
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
    x_actor_role: str = Header(default="", alias="X-Actor-Role"),
):
    if x_actor_role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return refund_order(db, order_id)

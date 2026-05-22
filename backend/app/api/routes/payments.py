import hashlib
import hmac
import logging

from fastapi import APIRouter, Header, HTTPException, Query, Request, status

from app.api.deps import DBSession, InternalAPIKey
from app.schemas.order import OrderCreateIn, PaymentInitOut, PaymentVerifyOut
from app.services.orders import handle_paystack_webhook, initialize_payment, verify_payment
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
    x_paystack_signature: str = Header(default=""),
):
    body = await request.body()

    if settings.paystack_secret_key:
        computed = hmac.new(
            settings.paystack_secret_key.encode(),
            body,
            hashlib.sha512,
        ).hexdigest()
        if not hmac.compare_digest(computed, x_paystack_signature):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    import json
    try:
        event_data = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    event = event_data.get("event", "")
    data = event_data.get("data", {})
    logger.info("Paystack webhook received: %s", event)
    handle_paystack_webhook(db, event, data)
    return {"received": True}

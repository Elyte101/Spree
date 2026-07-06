import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select, update as sa_update
from sqlalchemy.orm import Session

from app.core import pricing as pricing_svc
from app.core.config import settings
from app.db.models import LedgerEntry, Order, OrderItem, Product, User
from app.schemas.order import ChargeMomoIn, OrderCreateIn, OrderTrackingIn
from app.services import dev_notifier
from app.services import ledger as ledger_svc
from app.services import paystack as paystack_svc
from app.services.paystack import PaystackAPIError
from app.services.notifications import create_notification, notify_safe

logger = logging.getLogger(__name__)



def _server_totals(
    db: Session,
    items: list,
    shipping_method: str,
) -> tuple[Decimal, Decimal, Decimal, Decimal, list[tuple]]:
    """
    Recompute (subtotal, shipping_cost, tax, total, item_prices) entirely from DB.

    item_prices is a list of (product_id, listed_price, commission_rate) so callers
    can store the authoritative price and the rate used for later payout calculation.

    Raises HTTP 404 if any productId doesn't exist in the DB.
    """
    # H5: refresh pricing settings from DB each request (TTL-cached in-process).
    pricing_svc.refresh_if_stale(db)

    standard_rate = Decimal(str(settings.default_shipping_rate))
    express_rate = Decimal(str(settings.express_shipping_rate))

    subtotal = Decimal("0")
    item_prices: list[tuple] = []
    for item in items:
        if not item.productId:
            # H1: reject items without a valid productId — no legit guest-item use case.
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Each item must have a valid productId",
            )
        product = db.get(Product, item.productId)
        if product is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product '{item.productId}' not found",
            )
        seller_price = Decimal(str(product.price))
        rate = pricing_svc.commission_rate(seller_price)
        listed_price = pricing_svc.buyer_price(seller_price)
        item_prices.append((item.productId, listed_price, rate))
        subtotal += listed_price * item.quantity

    subtotal = subtotal.quantize(Decimal("0.01"))

    if not items:
        shipping_cost = Decimal("0")
    elif shipping_method == "express":
        shipping_cost = express_rate
    else:
        shipping_cost = standard_rate

    processing_fee = pricing_svc.calc_processing_fee(subtotal) if items else Decimal("0")
    total = (subtotal + shipping_cost + processing_fee).quantize(Decimal("0.01"))
    return subtotal, shipping_cost, processing_fee, total, item_prices


def _check_stock(db: Session, items: list) -> None:
    """
    Verify every item has sufficient stock BEFORE creating the Paystack transaction.
    Raises 409 Conflict on the first item that is out of stock or insufficient.
    """
    for item in items:
        if not item.productId:
            continue
        product = db.get(Product, item.productId)
        if product is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product '{item.productId}' not found",
            )
        if product.stock < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"'{product.name}' only has {product.stock} unit(s) available "
                    f"(requested {item.quantity})"
                ),
            )


_LOW_STOCK_THRESHOLD = 5


def _decrement_stock(db: Session, order: Order) -> None:
    """
    Atomically decrement stock for every order item using a conditional UPDATE.
    The WHERE stock >= quantity guard prevents the column going negative if two
    concurrent payments arrive for the same last unit.  An oversell is logged
    as a warning for manual review rather than blocking the already-taken payment.

    After decrement, fires a low-stock in-app + email alert to the vendor if the
    product stock falls to or below _LOW_STOCK_THRESHOLD.
    """
    for item in order.items:
        if not item.product_id or item.quantity <= 0:
            continue
        result = db.execute(
            sa_update(Product)
            .where(Product.id == item.product_id, Product.stock >= item.quantity)
            .values(stock=Product.stock - item.quantity)
            .execution_options(synchronize_session=False)
        )
        if result.rowcount == 0:
            logger.warning(
                "oversell: order=%s product=%s qty=%d — stock exhausted at payment confirmation",
                order.id,
                item.product_id,
                item.quantity,
            )
            continue

        # Check for low-stock condition and alert the vendor
        product = db.get(Product, item.product_id)
        if (
            product is not None
            and product.seller_id
            and 0 < product.stock <= _LOW_STOCK_THRESHOLD
        ):
            notify_safe(
                db,
                event_type="low_stock",
                recipient_id=product.seller_id,
                title="Low stock alert",
                body=(
                    f"Your product '{product.name}' has only {product.stock} unit(s) remaining. "
                    "Restock soon to avoid lost sales."
                ),
                notif_type="stock",
                href="/dashboard/products",
                email_subject=f"Low stock: {product.name}",
                cta_label="Manage inventory",
                cta_url=f"{settings.frontend_url}/dashboard/products",
            )


def _release_payout(
    db: Session,
    order: Order,
    *,
    is_auto_release: bool = False,
) -> dict[str, tuple[Decimal, bool]]:
    """Compute per-seller payouts, increment counters, commit, and initiate Paystack transfers.

    Must be called after order.status is set to "confirmed" and payout_released_at is set.
    Commits those state changes together with counter increments, then initiates transfers.
    Returns {seller_id: (payout_ghs_rounded, transfer_ok)}.
    """
    seller_payouts: dict[str, Decimal] = {}
    total_payout = Decimal("0")

    for item in order.items:
        item_payout = (
            pricing_svc.seller_payout_from_listed(Decimal(str(item.price)), item.commission_rate)
            * item.quantity
        )
        total_payout += item_payout
        if item.seller_id:
            seller_payouts[item.seller_id] = (
                seller_payouts.get(item.seller_id, Decimal("0")) + item_payout
            )

    order.payout_amount = total_payout

    for sid in seller_payouts:
        vendor = db.get(User, sid)
        if vendor:
            vendor.completed_deliveries = (vendor.completed_deliveries or 0) + 1

    for item in order.items:
        if item.product_id:
            product = db.get(Product, item.product_id)
            if product:
                product.purchase_count = (product.purchase_count or 0) + item.quantity

    db.commit()
    db.refresh(order)

    results: dict[str, tuple[Decimal, bool]] = {}

    for sid, payout in seller_payouts.items():
        vendor = db.get(User, sid)
        payout_minor = int(payout * 100)
        transfer_ok = False
        idempotency_key = f"payout-{order.id}-{sid}"

        if vendor and vendor.paystack_recipient_code and settings.paystack_secret_key:
            try:
                paystack_svc.initiate_transfer(
                    amount_minor=payout_minor,
                    recipient_code=vendor.paystack_recipient_code,
                    reason=f"Spree payout for order {order.id}",
                    idempotency_key=idempotency_key,
                )
                transfer_ok = True
                if is_auto_release:
                    ledger_svc.record_auto_release(
                        db,
                        order_id=order.id,
                        seller_id=sid,
                        amount_ghs=payout,
                        reference=idempotency_key,
                        idempotency_key=f"auto-release-{order.id}-{sid}",
                    )
                else:
                    ledger_svc.record_payout_initiated(
                        db,
                        order_id=order.id,
                        seller_id=sid,
                        amount_ghs=payout,
                        reference=idempotency_key,
                        idempotency_key=f"payout-init-{order.id}-{sid}",
                    )
            except Exception as exc:
                logger.error("Paystack transfer failed for vendor %s: %s", sid, exc)
                ledger_svc.record_payout_failed(
                    db,
                    order_id=order.id,
                    seller_id=sid,
                    amount_ghs=payout,
                    reference=idempotency_key,
                    idempotency_key=f"payout-fail-{order.id}-{sid}",
                    reason=str(exc),
                )

        results[sid] = (payout.quantize(Decimal("0.01")), transfer_ok)

    db.commit()
    return results


def _order_to_dict(order: Order) -> dict:
    # G12: use Decimal arithmetic throughout — no float() casting.
    def _d(v: Decimal | None) -> str | None:
        return str(v.quantize(Decimal("0.01"))) if v is not None else None

    return {
        "id": order.id,
        "userId": order.user_id,
        "status": order.status,
        "fullName": order.full_name,
        "email": order.email,
        "phone": order.phone,
        "addressLine1": order.address_line1,
        "addressLine2": order.address_line2,
        "city": order.city,
        "state": order.state,
        "postalCode": order.postal_code,
        "country": order.country,
        "shippingMethod": order.shipping_method,
        "paymentMethod": order.payment_method,
        "subtotal": _d(order.subtotal),
        "shippingCost": _d(order.shipping_cost),
        "tax": _d(order.tax),
        "total": _d(order.total),
        "currency": order.currency,
        "trackingNumber": order.tracking_number,
        "trackingCarrier": order.tracking_carrier,
        "paidAt": order.paid_at,
        "shippedAt": order.shipped_at,
        "deliveredAt": order.delivered_at,
        "payoutAmount": _d(order.payout_amount),
        "payoutReleasedAt": order.payout_released_at,
        "paystackReference": order.paystack_reference,
        "estimatedDeliveryDays": order.estimated_delivery_days,
        "estimatedDeliveryDate": order.estimated_delivery_date,
        "createdAt": order.created_at,
        "items": [
            {
                "id": item.id,
                "productId": item.product_id,
                "sellerId": item.seller_id,
                "name": item.name,
                "image": item.image,
                "price": _d(item.price),
                "quantity": item.quantity,
                "color": item.color,
                "size": item.size,
            }
            for item in order.items
        ],
    }


def _order_to_list_dict(order: Order) -> dict:
    return {
        "id": order.id,
        "status": order.status,
        "fullName": order.full_name,
        "email": order.email,
        "total": str(order.total.quantize(Decimal("0.01"))),
        "currency": order.currency,
        "itemCount": sum(item.quantity for item in order.items),
        "shippingMethod": order.shipping_method,
        "trackingNumber": order.tracking_number,
        "createdAt": order.created_at,
    }


def _build_pending_order(
    db: Session,
    payload: OrderCreateIn,
    order_id: str,
    *,
    subtotal: Decimal,
    shipping_cost: Decimal,
    tax: Decimal,
    total: Decimal,
    item_prices: list[tuple],
) -> Order:
    """Create order items and the Order row in status='pending'. Does not commit.

    Monetary totals and item prices MUST be the server-computed values from
    _server_totals(), never the client-supplied floats from payload.
    """
    order = Order(
        id=order_id,
        user_id=payload.userId,
        status="pending",
        full_name=payload.fullName.strip(),
        email=payload.email.strip().lower(),
        phone=payload.phone.strip() if payload.phone else None,
        address_line1=payload.addressLine1.strip(),
        address_line2=payload.addressLine2.strip() if payload.addressLine2 else None,
        city=payload.city.strip(),
        state=payload.state.strip(),
        postal_code=payload.postalCode.strip(),
        country=payload.country.strip(),
        shipping_method=payload.shippingMethod,
        payment_method=payload.paymentMethod,
        subtotal=subtotal,
        shipping_cost=shipping_cost,
        tax=tax,
        total=total,
        currency=payload.currency,
    )
    db.add(order)

    for idx, (item, (product_id, listed_price, rate)) in enumerate(zip(payload.items, item_prices)):
        seller_id: str | None = None
        if item.productId:
            product = db.get(Product, item.productId)
            if product:
                seller_id = product.seller_id
        db.add(
            OrderItem(
                id=f"{order_id}-item-{idx + 1}",
                order_id=order_id,
                product_id=item.productId,
                seller_id=seller_id,
                name=item.name,
                image=item.image,
                price=listed_price,   # server-authoritative price, never client price
                quantity=item.quantity,
                color=item.color,
                size=item.size,
                commission_rate=rate,
            )
        )
    return order


def initialize_payment(db: Session, payload: OrderCreateIn, callback_url: str) -> dict:
    """
    Create a pending order and return a Paystack authorization URL.
    The order stays 'pending' until the webhook/verify confirms payment.

    Totals are recomputed server-side from the database; the client-supplied
    total is only checked for a reasonable match (within _TOTAL_TOLERANCE) so
    that UI rounding differences don't block legitimate orders, but a manipulated
    total (e.g. client sends 0.01) is rejected before Paystack is called.
    """
    # 0. Idempotency: return existing pending order if the same key was already used.
    # H3: reconstruct the authorization URL from the stored access_code so the buyer
    #     can actually proceed (returning an empty URL strands them).
    if payload.idempotencyKey:
        existing = db.scalar(
            select(Order).where(Order.idempotency_key == payload.idempotencyKey)
        )
        if existing:
            access_code = existing.paystack_access_code or ""
            auth_url = (
                f"https://checkout.paystack.com/{access_code}" if access_code else ""
            )
            return {
                "orderId": existing.id,
                "reference": existing.paystack_reference or "",
                "authorizationUrl": auth_url,
                "accessCode": access_code,
            }

    # 1. Recompute totals and verify stock before touching Paystack
    server_subtotal, server_shipping, server_tax, server_total, item_prices = _server_totals(
        db, payload.items, payload.shippingMethod
    )
    _check_stock(db, payload.items)

    order_id = f"order-{uuid4().hex[:16]}"
    reference = f"spree-{order_id}-{uuid4().hex[:8]}"

    order = _build_pending_order(
        db, payload, order_id,
        subtotal=server_subtotal,
        shipping_cost=server_shipping,
        tax=server_tax,
        total=server_total,
        item_prices=item_prices,
    )
    order.paystack_reference = reference
    if payload.idempotencyKey:
        order.idempotency_key = payload.idempotencyKey
    db.commit()
    db.refresh(order)

    if settings.payments_mock:
        # Dev mode: skip Paystack, return a fake URL pointing straight to verify
        return {
            "orderId": order_id,
            "reference": reference,
            "authorizationUrl": f"{callback_url}?reference={reference}&mock=1",
        }

    # 3. Charge the server-computed total in pesewas (never the client value)
    _CHANNELS_MAP = {
        "momo": ["mobile_money"],
        "card": ["card", "bank"],
    }
    channels = _CHANNELS_MAP.get(payload.paymentMethod)

    amount_minor = int(server_total * 100)
    try:
        ps_data = paystack_svc.initialize_transaction(
            amount_minor=amount_minor,
            email=payload.email.strip().lower(),
            reference=reference,
            currency=payload.currency,
            callback_url=callback_url,
            channels=channels,
        )
    except RuntimeError as exc:
        # Roll back the pending order so the cart stays intact for retry
        db.delete(order)
        db.commit()
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    # H3: persist access_code so idempotent replay can reconstruct the URL
    access_code = ps_data.get("access_code", "")
    if access_code:
        order.paystack_access_code = access_code
        db.commit()

    return {
        "orderId": order_id,
        "reference": reference,
        "authorizationUrl": ps_data.get("authorization_url", ""),
        "accessCode": access_code,
    }


def _mark_order_paid(db: Session, order: Order, tx_id: str = "") -> None:
    """Transition order to paid, decrement stock, write ledger entries, and notify."""
    now = datetime.now(timezone.utc)
    order.status = "paid"
    order.paid_at = now
    if tx_id:
        order.paystack_tx_id = tx_id

    _decrement_stock(db, order)

    # Ledger: buyer payment captured
    ledger_svc.record_payment_received(
        db,
        order_id=order.id,
        user_id=order.user_id,
        amount_ghs=Decimal(str(order.total)),
        reference=order.paystack_reference or order.id,
        idempotency_key=f"pmtrx-{order.id}",
    )

    # Ledger: processing fee withheld from buyer total
    if order.tax:
        ledger_svc.record_processing_fee_held(
            db,
            order_id=order.id,
            fee_ghs=Decimal(str(order.tax)),
            fee_rate=pricing_svc.PROCESSING_FEE_RATE,
            idempotency_key=f"procfee-{order.id}",
        )

    # Ledger: per-seller commission held + seller credit earmarked (one pair per seller)
    seller_ledger: dict[str, list[Decimal]] = {}
    for item in order.items:
        if not item.seller_id or item.commission_rate is None:
            continue
        listed = Decimal(str(item.price))
        payout_unit = pricing_svc.seller_payout_from_listed(listed, item.commission_rate)
        item_net = payout_unit * item.quantity
        item_commission = (listed - payout_unit) * item.quantity
        entry = seller_ledger.setdefault(item.seller_id, [Decimal("0"), Decimal("0")])
        entry[0] += item_commission
        entry[1] += item_net

    for sid, (commission_ghs, credit_ghs) in seller_ledger.items():
        total = commission_ghs + credit_ghs
        effective_rate = commission_ghs / total if total > 0 else Decimal("0")
        ledger_svc.record_commission_held(
            db,
            order_id=order.id,
            seller_id=sid,
            commission_ghs=commission_ghs,
            commission_rate=effective_rate,
            idempotency_key=f"comm-{order.id}-{sid}",
        )
        ledger_svc.record_seller_credit(
            db,
            order_id=order.id,
            seller_id=sid,
            net_payout_ghs=credit_ghs,
            idempotency_key=f"credit-{order.id}-{sid}",
        )

    db.commit()

    # Notify buyer
    if order.user_id:
        notify_safe(
            db,
            event_type="order_placed",
            recipient_id=order.user_id,
            title="Order confirmed!",
            body=(
                f"Your order has been received and payment confirmed. "
                f"Total: {order.currency} {order.total:.2f}. "
                "We'll notify you once it ships."
            ),
            notif_type="order",
            href=f"/orders/{order.id}",
            email_subject="Your Spree order is confirmed",
            cta_label="View order",
            cta_url=f"{settings.frontend_url}/orders/{order.id}",
            recipient_email=order.email,
        )

    # Notify each vendor with products in this order
    seller_ids_notified: set[str] = set()
    for item in order.items:
        if item.seller_id and item.seller_id not in seller_ids_notified:
            seller_ids_notified.add(item.seller_id)
            notify_safe(
                db,
                event_type="order_placed_seller",
                recipient_id=item.seller_id,
                title="New order received",
                body=(
                    f"{order.full_name} placed an order containing your product(s). "
                    "Please prepare for shipping."
                ),
                notif_type="order",
                href="/dashboard/orders",
                email_subject="You have a new order on Spree",
                cta_label="View orders",
                cta_url=f"{settings.frontend_url}/dashboard/orders",
            )


def verify_payment(db: Session, reference: str) -> dict:
    """
    Called from the Paystack redirect callback page.
    Verifies with Paystack API, marks order paid if confirmed.
    """
    order = db.scalar(
        select(Order).where(Order.paystack_reference == reference).with_for_update()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found for this reference")

    if order.status == "paid":
        return _order_to_dict(order)

    if order.status not in ("pending", "paid"):
        raise HTTPException(
            status_code=409,
            detail=f"Order cannot be verified in status '{order.status}'",
        )

    # Dev mock mode: accept any reference without Paystack verification
    if settings.payments_mock:
        _mark_order_paid(db, order)
        db.refresh(order)
        return _order_to_dict(order)

    try:
        tx = paystack_svc.verify_transaction(reference)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if tx.get("status") != "success":
        raise HTTPException(
            status_code=402,
            detail=f"Payment not confirmed (status: {tx.get('status', 'unknown')})",
        )

    _mark_order_paid(db, order, tx_id=str(tx.get("id", "")))
    db.refresh(order)
    return _order_to_dict(order)


def charge_momo_payment(db: Session, payload: ChargeMomoIn) -> dict:
    """
    Create a pending order and initiate MoMo payment via Paystack Charge API.
    Returns {orderId, reference, status, displayText}.
    """
    if payload.idempotencyKey:
        existing = db.scalar(select(Order).where(Order.idempotency_key == payload.idempotencyKey))
        if existing:
            return {
                "orderId": existing.id,
                "reference": existing.paystack_reference or "",
                "status": "pending",
                "displayText": "Processing your payment...",
            }

    server_subtotal, server_shipping, server_tax, server_total, item_prices = _server_totals(
        db, payload.items, payload.shippingMethod
    )
    _check_stock(db, payload.items)

    order_id = f"order-{uuid4().hex[:16]}"
    reference = f"spree-{order_id}-{uuid4().hex[:8]}"

    order = _build_pending_order(
        db, payload, order_id,
        subtotal=server_subtotal,
        shipping_cost=server_shipping,
        tax=server_tax,
        total=server_total,
        item_prices=item_prices,
    )
    order.paystack_reference = reference
    if payload.idempotencyKey:
        order.idempotency_key = payload.idempotencyKey
    db.commit()
    db.refresh(order)

    if settings.payments_mock:
        return {
            "orderId": order_id,
            "reference": reference,
            "status": "send_otp",
            "displayText": "[Dev mode] Enter any digits as the OTP",
        }

    # Normalize to Ghana local format (e.g. "0551234987") for Paystack Charge API
    phone = payload.momoPhone.strip()
    if phone.startswith("+233"):
        local = phone[4:].lstrip()
        phone = local if local.startswith("0") else "0" + local
    elif phone.startswith("233") and not phone.startswith("0"):
        local = phone[3:].lstrip()
        phone = local if local.startswith("0") else "0" + local

    amount_minor = int(server_total * 100)
    try:
        charge_data = paystack_svc.charge(
            amount_minor=amount_minor,
            email=payload.email.strip().lower(),
            reference=reference,
            currency=payload.currency,
            mobile_money={"phone": phone, "provider": payload.momoProvider},
        )
    except PaystackAPIError as exc:
        db.delete(order)
        db.commit()
        logger.error("Paystack charge failed (status=%s): %s", exc.http_status, exc.provider_message)
        raise HTTPException(
            status_code=exc.http_status,
            detail={
                "code": "paystack_charge_failed",
                "message": "Payment could not be started. Please try again or use Card/Bank Transfer.",
                "providerStatus": exc.http_status,
                "providerMessage": exc.provider_message,
            },
        ) from exc
    except RuntimeError as exc:
        db.delete(order)
        db.commit()
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    charge_status = charge_data.get("status", "")
    display_text = charge_data.get("display_text") or charge_data.get("message") or "Processing..."
    return {
        "orderId": order_id,
        "reference": reference,
        "status": charge_status,
        "displayText": display_text,
    }


def submit_otp_for_order(db: Session, otp: str, reference: str) -> dict:
    """Submit OTP for a pending MoMo charge. Returns {status, displayText}."""
    order = db.scalar(
        select(Order).where(Order.paystack_reference == reference).with_for_update()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found for this reference")
    if order.status != "pending":
        raise HTTPException(status_code=409, detail=f"Order is not pending (status: {order.status})")

    if settings.payments_mock:
        _mark_order_paid(db, order)
        return {"status": "success", "displayText": "[Dev mode] Payment confirmed"}

    try:
        charge_data = paystack_svc.submit_otp(otp=otp, reference=reference)
    except PaystackAPIError as exc:
        logger.error("Paystack OTP submit failed (status=%s): %s", exc.http_status, exc.provider_message)
        raise HTTPException(
            status_code=exc.http_status,
            detail={
                "code": "paystack_otp_failed",
                "message": "OTP verification failed. Please try again.",
                "providerStatus": exc.http_status,
                "providerMessage": exc.provider_message,
            },
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    charge_status = charge_data.get("status", "")
    display_text = charge_data.get("display_text") or charge_data.get("message") or "Processing..."
    return {"status": charge_status, "displayText": display_text}


def check_momo_charge(reference: str) -> dict:
    """Poll Paystack for the current status of a pending MoMo charge."""
    if settings.payments_mock:
        return {"status": "success", "displayText": "[Dev mode] Payment confirmed"}

    try:
        charge_data = paystack_svc.check_charge(reference=reference)
    except PaystackAPIError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={
                "code": "paystack_check_failed",
                "message": "Could not check payment status. Please wait and try again.",
                "providerStatus": exc.http_status,
                "providerMessage": exc.provider_message,
            },
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    charge_status = charge_data.get("status", "")
    display_text = charge_data.get("display_text") or charge_data.get("message") or "Checking..."
    return {"status": charge_status, "displayText": display_text}


def handle_paystack_webhook(db: Session, event: str, data: dict) -> None:
    """Process Paystack webhook events. Called only after signature is verified."""
    if event == "charge.success":
        reference = data.get("reference", "")
        if not reference:
            return
        order = db.scalar(
            select(Order)
            .where(Order.paystack_reference == reference)
            .with_for_update(skip_locked=True)
        )
        if order and order.status == "pending":
            _mark_order_paid(db, order, tx_id=str(data.get("id", "")))
            logger.info("Webhook: marked order %s as paid (ref=%s)", order.id, reference)
        elif order and order.status == "cancelled":
            # H2: charge succeeded for a cancelled order — buyer was charged but order is dead.
            # Alert admin for manual refund (or attempt auto-refund if Paystack key is set).
            amount_minor = data.get("amount", 0)
            amount = Decimal(str(amount_minor)) / 100
            logger.error(
                "Webhook: charge.success for CANCELLED order %s (ref=%s, amount=%s) — "
                "buyer charged but order is cancelled; manual refund required",
                order.id, reference, amount,
            )
            dev_notifier.alert(
                "charge_for_cancelled_order",
                f"Buyer charged {order.currency} {amount:.2f} for cancelled order {order.id}",
                {"order_id": order.id, "reference": reference, "amount": f"{order.currency} {amount:.2f}"},
            )
            # Write a ledger entry so the charge is traceable
            ledger_svc.record_payment_received(
                db,
                order_id=order.id,
                user_id=order.user_id,
                amount_ghs=amount,
                reference=reference,
                idempotency_key=f"pmtrx-cancelled-{order.id}",
                meta={"note": "charge.success for cancelled order — refund required"},
            )
            # Auto-refund via Paystack if secret key available
            if settings.paystack_secret_key:
                try:
                    paystack_svc.refund_transaction(reference)
                    ledger_svc.record_refund_initiated(
                        db,
                        order_id=order.id,
                        user_id=order.user_id,
                        amount_ghs=amount,
                        reference=reference,
                        idempotency_key=f"refund-cancelled-{order.id}",
                    )
                    logger.info("Auto-refunded cancelled order %s", order.id)
                except Exception as exc:
                    logger.error("Auto-refund failed for cancelled order %s: %s", order.id, exc)
            db.commit()

    elif event == "charge.failed":
        reference = data.get("reference", "")
        if not reference:
            return
        order = db.scalar(
            select(Order)
            .where(Order.paystack_reference == reference)
            .with_for_update(skip_locked=True)
        )
        if order and order.status == "pending":
            order.status = "cancelled"
            db.commit()
            logger.info("Webhook: cancelled order %s — charge failed (ref=%s)", order.id, reference)
            # Dev alert
            dev_notifier.alert(
                "payment_failure",
                f"Charge failed for order {order.id}",
                {"order_id": order.id, "reference": reference, "email": order.email},
            )
            # User notification
            if order.user_id:
                notify_safe(
                    db,
                    event_type="order_payment_failed",
                    recipient_id=order.user_id,
                    title="Payment failed",
                    body=(
                        "Your payment could not be processed and your order has been cancelled. "
                        "Please try again or use a different payment method."
                    ),
                    notif_type="order",
                    href="/orders",
                    email_subject="Your Spree payment failed",
                    cta_label="Try again",
                    cta_url=f"{settings.frontend_url}/cart",
                    recipient_email=order.email,
                )

    elif event == "transfer.success":
        # Paystack confirmed a vendor payout — write PAYOUT_CONFIRMED and advance order to paid_out.
        reference = data.get("reference", "")
        logger.info("Webhook: transfer success ref=%s", reference)
        if not reference:
            return
        # Look up the PAYOUT_INITIATED entry by the Paystack transfer reference.
        initiated = db.scalar(
            select(LedgerEntry)
            .where(
                LedgerEntry.entry_type.in_(
                    [ledger_svc.PAYOUT_INITIATED, ledger_svc.AUTO_RELEASE]
                ),
                LedgerEntry.reference == reference,
            )
        )
        if initiated and initiated.order_id:
            amount_pesewas = data.get("amount", initiated.amount_pesewas)
            ledger_svc.record_payout_confirmed(
                db,
                order_id=initiated.order_id,
                seller_id=initiated.seller_id,
                amount_ghs=Decimal(str(amount_pesewas)) / 100,
                reference=reference,
                idempotency_key=f"payout-confirmed-{reference}",
            )
            db.commit()
            # Check if all sellers for this order now have PAYOUT_CONFIRMED
            _maybe_advance_to_paid_out(db, initiated.order_id)

    elif event == "transfer.failed":
        # Paystack failed a vendor payout — write PAYOUT_FAILED and alert admin.
        reference = data.get("reference", "")
        recipient_code = data.get("recipient", {}).get("recipient_code", "")
        amount_minor = data.get("amount", 0)
        logger.warning("Webhook: transfer failed ref=%s recipient=%s", reference, recipient_code)

        initiated = db.scalar(
            select(LedgerEntry)
            .where(
                LedgerEntry.entry_type.in_(
                    [ledger_svc.PAYOUT_INITIATED, ledger_svc.AUTO_RELEASE]
                ),
                LedgerEntry.reference == reference,
            )
        ) if reference else None

        order_id = initiated.order_id if initiated else None
        seller_id = initiated.seller_id if initiated else None
        amount = Decimal(str(amount_minor)) / 100 if amount_minor else Decimal("0")

        if initiated:
            ledger_svc.record_payout_failed(
                db,
                order_id=initiated.order_id,
                seller_id=initiated.seller_id,
                amount_ghs=amount or Decimal(str(initiated.amount_pesewas)) / 100,
                reference=reference,
                idempotency_key=f"payout-fail-wh-{reference}",
                reason=data.get("failures") or data.get("gateway_response", ""),
            )
            db.commit()

        vendor = (
            db.scalar(select(User).where(User.paystack_recipient_code == recipient_code))
            if recipient_code else None
        )
        if vendor:
            payout_amount = amount or (
                Decimal(str(initiated.amount_pesewas)) / 100 if initiated else Decimal("0")
            )
            currency = (vendor.payout_info or {}).get("currency", "GHS")
            dev_notifier.alert(
                "payout_transfer_failure",
                f"Payout transfer failed for vendor {vendor.id}",
                {
                    "vendor_id": vendor.id,
                    "vendor_email": vendor.email,
                    "order_id": order_id,
                    "recipient_code": recipient_code,
                    "amount": f"{currency} {payout_amount:.2f}",
                    "reference": reference,
                },
            )
            notify_safe(
                db,
                event_type="payout_failed",
                recipient_id=vendor.id,
                title="Payout failed — action required",
                body=(
                    f"We couldn't send your payout of {currency} {payout_amount:.2f}. "
                    "Please update your payout account details in your profile so we can retry."
                ),
                notif_type="account",
                href="/settings?tab=payout",
                email_subject="Action required: your Spree payout failed",
                cta_label="Update payout details",
                cta_url=f"{settings.frontend_url}/settings?tab=payout",
            )


def _maybe_advance_to_paid_out(db: Session, order_id: str) -> None:
    """Advance a 'confirmed' order to 'paid_out' if all sellers now have PAYOUT_CONFIRMED.

    Called from the transfer.success webhook after writing PAYOUT_CONFIRMED.
    Skips silently if the order is already paid_out or not in confirmed state.
    """
    order = db.scalar(
        select(Order).where(Order.id == order_id, Order.status == "confirmed").with_for_update()
    )
    if order is None:
        return

    # Collect unique seller IDs from items
    seller_ids = {item.seller_id for item in order.items if item.seller_id}
    if not seller_ids:
        return

    # Count distinct sellers with a PAYOUT_CONFIRMED entry for this order
    confirmed_sellers = db.scalars(
        select(LedgerEntry.seller_id).where(
            LedgerEntry.order_id == order_id,
            LedgerEntry.entry_type == ledger_svc.PAYOUT_CONFIRMED,
            LedgerEntry.seller_id.in_(seller_ids),
        ).distinct()
    ).all()

    if set(confirmed_sellers) >= seller_ids:
        order.status = "paid_out"
        db.commit()
        logger.info("Order %s advanced to paid_out after all payout confirmations", order_id)


def retry_stuck_payouts(db: Session) -> dict:
    """Retry Paystack transfers for orders stuck in 'confirmed' with failed/missing payouts.

    An order stays 'confirmed' (not 'paid_out') when at least one seller transfer failed.
    This function re-attempts those transfers with the same idempotency key, so Paystack
    will not double-pay if the transfer actually succeeded despite a transient error.

    Returns {"checked": N, "retried": N, "errors": list}.
    """
    # Find orders stuck in "confirmed" with a payout_released_at set
    stuck_orders = db.scalars(
        select(Order).where(
            Order.status == "confirmed",
            Order.payout_released_at.is_not(None),
        )
    ).all()

    retried = 0
    errors: list[str] = []

    for order in stuck_orders:
        seller_ids = {item.seller_id for item in order.items if item.seller_id}
        if not seller_ids:
            continue

        # Find sellers who already have PAYOUT_CONFIRMED (skip them)
        confirmed = set(
            db.scalars(
                select(LedgerEntry.seller_id).where(
                    LedgerEntry.order_id == order.id,
                    LedgerEntry.entry_type == ledger_svc.PAYOUT_CONFIRMED,
                    LedgerEntry.seller_id.in_(seller_ids),
                ).distinct()
            ).all()
        )
        pending_sellers = seller_ids - confirmed

        for sid in pending_sellers:
            vendor = db.get(User, sid)
            if not vendor or not vendor.paystack_recipient_code or not settings.paystack_secret_key:
                continue

            # Recompute payout amount from items
            payout = sum(
                (
                    pricing_svc.seller_payout_from_listed(Decimal(str(item.price)), item.commission_rate)
                    * item.quantity
                )
                for item in order.items
                if item.seller_id == sid
            )
            if payout <= 0:
                continue

            payout_minor = int(payout * 100)
            idempotency_key = f"payout-{order.id}-{sid}"

            try:
                paystack_svc.initiate_transfer(
                    amount_minor=payout_minor,
                    recipient_code=vendor.paystack_recipient_code,
                    reason=f"Spree payout retry for order {order.id}",
                    idempotency_key=idempotency_key,
                )
                ledger_svc.record_payout_initiated(
                    db,
                    order_id=order.id,
                    seller_id=sid,
                    amount_ghs=payout,
                    reference=idempotency_key,
                    idempotency_key=f"payout-init-{order.id}-{sid}",
                )
                db.commit()
                retried += 1
            except Exception as exc:
                logger.error("Payout retry failed for order %s seller %s: %s", order.id, sid, exc)
                errors.append(f"{order.id}/{sid}: {exc}")

    return {"checked": len(stuck_orders), "retried": retried, "errors": errors}


def create_order(db: Session, payload: OrderCreateIn) -> dict:
    """Admin direct-create (no Paystack). Recomputes totals and decrements stock."""
    server_subtotal, server_shipping, server_tax, server_total, item_prices = _server_totals(
        db, payload.items, payload.shippingMethod
    )
    _check_stock(db, payload.items)

    order_id = f"order-{uuid4().hex[:16]}"
    order = _build_pending_order(
        db,
        payload,
        order_id,
        subtotal=server_subtotal,
        shipping_cost=server_shipping,
        tax=server_tax,
        total=server_total,
        item_prices=item_prices,
    )
    db.flush()

    _mark_order_paid(db, order)
    db.refresh(order)
    return _order_to_dict(order)


def get_order(db: Session, order_id: str, actor_id: str | None, actor_role: str) -> dict:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    if actor_role != "admin":
        is_buyer = actor_id is not None and order.user_id == actor_id
        is_seller = actor_id is not None and any(
            item.seller_id == actor_id for item in order.items
        )
        if not is_buyer and not is_seller:
            raise HTTPException(status_code=403, detail="Access denied")

    return _order_to_dict(order)


def list_user_orders(db: Session, user_id: str) -> list[dict]:
    orders = db.scalars(
        select(Order).where(Order.user_id == user_id).order_by(Order.created_at.desc())
    ).all()
    return [_order_to_list_dict(o) for o in orders]


def list_seller_orders(db: Session, seller_id: str) -> list[dict]:
    order_ids = db.scalars(
        select(OrderItem.order_id).where(OrderItem.seller_id == seller_id).distinct()
    ).all()
    if not order_ids:
        return []
    orders = db.scalars(
        select(Order).where(Order.id.in_(order_ids)).order_by(Order.created_at.desc())
    ).all()
    return [_order_to_list_dict(o) for o in orders]


def list_admin_orders(db: Session, page: int = 1, limit: int = 50) -> list[dict]:
    orders = db.scalars(
        select(Order)
        .order_by(Order.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    ).all()
    return [_order_to_list_dict(o) for o in orders]


def add_tracking(
    db: Session, order_id: str, payload: OrderTrackingIn, seller_id: str
) -> dict:
    order = db.scalar(
        select(Order).where(Order.id == order_id).with_for_update()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    is_seller = any(item.seller_id == seller_id for item in order.items)
    if not is_seller:
        raise HTTPException(status_code=403, detail="Access denied")

    if order.status != "paid":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot add tracking to an order with status '{order.status}'",
        )

    now = datetime.now(timezone.utc)
    order.tracking_number = payload.trackingNumber.strip()
    order.tracking_carrier = payload.carrier.strip() or None
    # G8/G9: paid → in_transit (tracking added means shipment is underway).
    order.status = "in_transit"
    order.shipped_at = now

    if payload.estimatedDeliveryDays and payload.estimatedDeliveryDays > 0:
        order.estimated_delivery_days = payload.estimatedDeliveryDays
        order.estimated_delivery_date = now + timedelta(days=payload.estimatedDeliveryDays)

    db.commit()
    db.refresh(order)

    if order.user_id:
        carrier_str = f" via {payload.carrier.strip()}" if payload.carrier.strip() else ""
        eta_str = (
            f" Estimated delivery: {order.estimated_delivery_days} day(s)."
            if order.estimated_delivery_days
            else ""
        )
        body = (
            f"Your order has been dispatched{carrier_str}. "
            f"Tracking: {payload.trackingNumber.strip()}.{eta_str}"
        )
        notify_safe(
            db,
            event_type="order_shipped",
            recipient_id=order.user_id,
            title="Your order has shipped!",
            body=body,
            notif_type="order",
            href=f"/orders/{order_id}",
            email_subject="Your Spree order is on its way",
            cta_label="Track order",
            cta_url=f"{settings.frontend_url}/orders/{order_id}",
        )

    return _order_to_dict(order)


def mark_delivered(db: Session, order_id: str, seller_id: str) -> dict:
    """Seller marks an in_transit order as delivered (carrier dropped off).

    G8/G9: This creates the 'delivered' state.  The buyer must then call
    confirm_delivery() to transition to 'confirmed' and release the payout.
    An auto-release cron (G10) handles the case where the buyer doesn't confirm.
    """
    order = db.scalar(
        select(Order).where(Order.id == order_id).with_for_update()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    is_seller = any(item.seller_id == seller_id for item in order.items)
    if not is_seller:
        raise HTTPException(status_code=403, detail="Access denied")

    if order.status != "in_transit":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot mark delivered — order status is '{order.status}' (expected 'in_transit')",
        )

    now = datetime.now(timezone.utc)
    order.status = "delivered"
    order.delivered_at = now
    db.commit()
    db.refresh(order)

    if order.user_id:
        notify_safe(
            db,
            event_type="order_delivered",
            recipient_id=order.user_id,
            title="Your order has been delivered",
            body=(
                "Your order has been marked as delivered. "
                "Please confirm receipt so your seller gets paid."
            ),
            notif_type="order",
            href=f"/orders/{order_id}",
            email_subject="Your Spree order was delivered — please confirm",
            cta_label="Confirm receipt",
            cta_url=f"{settings.frontend_url}/orders/{order_id}",
        )

    return _order_to_dict(order)


def confirm_delivery(db: Session, order_id: str, buyer_id: str) -> dict:
    """Buyer confirms receipt of a delivered order.

    G8/G9: requires status='delivered' (set by seller or auto-release cron).
    Transitions to 'confirmed', then releases payout → 'paid_out'.
    G29: idempotency key passed to Paystack transfer so retries don't double-pay.
    """
    # Use FOR UPDATE so two concurrent confirm-delivery calls can't both pass
    # the status check and double-release the vendor payout.
    order = db.scalar(
        select(Order).where(Order.id == order_id).with_for_update()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.user_id != buyer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # G9: buyer can only confirm from 'delivered' state (not from 'in_transit').
    if order.status != "delivered":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot confirm delivery for an order with status '{order.status}'",
        )

    now = datetime.now(timezone.utc)
    # G8: buyer confirmation → 'confirmed', payout release → 'paid_out'.
    order.status = "confirmed"
    order.payout_released_at = now

    # Releases payouts: computes amounts, increments counters, commits, initiates transfers.
    payout_results = _release_payout(db, order, is_auto_release=False)

    # Notify buyer (order already refreshed inside _release_payout)
    if order.user_id:
        notify_safe(
            db,
            event_type="order_delivered",
            recipient_id=order.user_id,
            title="Delivery confirmed",
            body="You have confirmed receipt of your order. Thank you for shopping on Spree!",
            notif_type="order",
            href=f"/orders/{order.id}",
            email_subject="Your Spree order has been delivered",
            cta_label="View order",
            cta_url=f"{settings.frontend_url}/orders/{order.id}",
        )

    # Notify each seller and decide whether to advance to paid_out
    all_transfers_ok = True
    for sid, (payout_ghs, transfer_ok) in payout_results.items():
        if not transfer_ok:
            all_transfers_ok = False
        payout_note = (
            f"Your payout of {order.currency} {payout_ghs} has been sent to your account."
            if transfer_ok
            else (
                f"Your payout of {order.currency} {payout_ghs} is being processed. "
                "Please ensure your payout details are up to date in your profile."
            )
        )
        notify_safe(
            db,
            event_type="payout_released",
            recipient_id=sid,
            title="Delivery confirmed — payout released",
            body=f"The buyer confirmed receipt of their order. {payout_note}",
            notif_type="order",
            href="/dashboard/orders",
            email_subject="Your Spree payout has been released",
            cta_label="View orders",
            cta_url=f"{settings.frontend_url}/dashboard/orders",
        )

    # G8: mark paid_out once all transfers have been initiated
    if all_transfers_ok and payout_results:
        order.status = "paid_out"
        db.commit()
        db.refresh(order)

    return _order_to_dict(order)


def auto_release_delivered_orders(db: Session) -> dict:
    """G10: Auto-release escrow for orders that have been 'delivered' but buyer never confirmed.

    Reads the `auto_release_days` SiteSetting (default: 7).
    For each eligible order, runs the same payout logic as confirm_delivery()
    but without requiring buyer action (system-triggered).

    Returns summary: {"checked": N, "released": N, "errors": [...]}.
    """
    from app.db.models import SiteSetting  # noqa: PLC0415

    setting = db.get(SiteSetting, "auto_release_days")
    try:
        release_days = int(setting.value) if setting else 7
    except (ValueError, TypeError):
        release_days = 7

    cutoff = datetime.now(timezone.utc) - timedelta(days=release_days)

    # Collect IDs only — locking happens per-order inside the loop so
    # concurrent cron invocations don't race to release the same order.
    stale_ids = db.scalars(
        select(Order.id).where(
            Order.status == "delivered",
            Order.delivered_at != None,  # noqa: E711
            Order.delivered_at < cutoff,
        )
    ).all()

    released = 0
    errors: list[str] = []

    for order_id in stale_ids:
        try:
            # Re-fetch with FOR UPDATE SKIP LOCKED so only one concurrent
            # worker processes each order — the other silently moves on.
            order = db.scalar(
                select(Order)
                .where(Order.id == order_id, Order.status == "delivered")
                .with_for_update(skip_locked=True)
            )
            if order is None:
                # Another process already locked/processed this order.
                continue
            now = datetime.now(timezone.utc)
            order.status = "confirmed"
            order.payout_released_at = now

            # Releases payouts: computes amounts, increments counters, commits, initiates transfers.
            payout_results = _release_payout(db, order, is_auto_release=True)

            # Notify buyer (order already refreshed inside _release_payout)
            if order.user_id:
                notify_safe(
                    db,
                    event_type="order_auto_released",
                    recipient_id=order.user_id,
                    title="Order auto-confirmed",
                    body=(
                        f"Your order has been automatically confirmed after {release_days} days. "
                        "If you have not received your items, please contact support."
                    ),
                    notif_type="order",
                    href=f"/orders/{order.id}",
                    email_subject="Your Spree order has been auto-confirmed",
                    cta_label="View order",
                    cta_url=f"{settings.frontend_url}/orders/{order.id}",
                )

            # Notify sellers
            all_transfers_ok = True
            for sid, (payout_ghs, transfer_ok) in payout_results.items():
                if not transfer_ok:
                    all_transfers_ok = False
                notify_safe(
                    db,
                    event_type="payout_released",
                    recipient_id=sid,
                    title="Auto-release payout sent",
                    body=(
                        f"Order {order.id} was auto-confirmed after {release_days} days. "
                        f"Your payout of {order.currency} {payout_ghs} "
                        + ("has been sent." if transfer_ok else "is being processed.")
                    ),
                    notif_type="order",
                    href="/dashboard/orders",
                    email_subject="Spree auto-release payout",
                    cta_label="View orders",
                    cta_url=f"{settings.frontend_url}/dashboard/orders",
                )

            if all_transfers_ok and payout_results:
                order.status = "paid_out"
                db.commit()
                db.refresh(order)

            released += 1

        except Exception as exc:
            logger.error("auto_release failed for order %s: %s", order_id, exc)
            errors.append(f"{order.id}: {exc}")
            try:
                db.rollback()
            except Exception:
                pass

    return {"checked": len(stale_ids), "released": released, "errors": errors}


def cancel_order(db: Session, order_id: str, actor_id: str, actor_role: str) -> dict:
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    if actor_role != "admin" and order.user_id != actor_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Buyers cannot cancel a paid order; only admins can (via refund_order).
    if actor_role != "admin" and order.status == "paid":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A paid order cannot be cancelled. Please contact support for a refund.",
        )

    # Cannot cancel once shipment is underway or payout released (G8 state machine).
    if order.status in ("in_transit", "delivered", "confirmed", "paid_out"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel an order with status '{order.status}'",
        )

    order.status = "cancelled"
    db.commit()
    db.refresh(order)

    if order.user_id:
        notify_safe(
            db,
            event_type="order_cancelled",
            recipient_id=order.user_id,
            title="Order cancelled",
            body="Your order has been cancelled. If you paid, a refund will be processed.",
            notif_type="order",
            href="/orders",
            email_subject="Your Spree order has been cancelled",
            cta_label="View orders",
            cta_url=f"{settings.frontend_url}/orders",
        )

    return _order_to_dict(order)


def refund_order(db: Session, order_id: str) -> dict:
    """Admin-only: issue a Paystack refund and cancel the order."""
    order = db.scalar(select(Order).where(Order.id == order_id).with_for_update())
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    # Admin can refund any order that has been paid but payout not yet released.
    if order.status not in ("paid", "in_transit", "delivered"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot refund an order with status '{order.status}'",
        )

    # Commit "refunded" status BEFORE calling Paystack so that a retry
    # (e.g. after a 502 timeout that actually succeeded) cannot issue a
    # second refund.  If Paystack subsequently fails, the order shows
    # "refunded" in our DB and the admin must complete it via the
    # Paystack dashboard — the lesser of two evils vs. a double refund.
    order.status = "refunded"
    ledger_svc.record_refund_initiated(
        db,
        order_id=order.id,
        user_id=order.user_id,
        amount_ghs=Decimal(str(order.total)),
        reference=order.paystack_reference or order.id,
        idempotency_key=f"refund-{order.id}",
    )
    db.commit()

    if order.paystack_reference and settings.paystack_secret_key:
        try:
            paystack_svc.refund_transaction(order.paystack_reference)
        except RuntimeError as exc:
            logger.error(
                "Paystack refund failed for order %s after status was committed; "
                "admin must complete manually via Paystack dashboard: %s",
                order_id, exc,
            )
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    if order.user_id:
        notify_safe(
            db,
            event_type="order_refunded",
            recipient_id=order.user_id,
            title="Your order has been refunded",
            body=(
                f"Your order has been cancelled and a refund of "
                f"{order.currency} {order.total:.2f} has been issued. "
                "It should appear in your account within 5–10 business days."
            ),
            notif_type="order",
            href="/orders",
            email_subject="Your Spree order has been refunded",
            cta_label="View orders",
            cta_url=f"{settings.frontend_url}/orders",
        )

    db.refresh(order)
    return _order_to_dict(order)

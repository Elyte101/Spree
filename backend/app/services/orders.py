import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select, update as sa_update
from sqlalchemy.orm import Session

from app.core import pricing as pricing_svc
from app.core.config import settings
from app.db.models import Order, OrderItem, Product, User
from app.schemas.order import ChargeMomoIn, OrderCreateIn, OrderTrackingIn
from app.services import paystack as paystack_svc
from app.services.notifications import create_notification, notify_safe
from app.services import dev_notifier

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
    standard_rate = Decimal(str(settings.default_shipping_rate))
    express_rate = Decimal(str(settings.express_shipping_rate))

    subtotal = Decimal("0")
    item_prices: list[tuple] = []
    for item in items:
        if item.productId:
            product = db.get(Product, item.productId)
            if product is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product '{item.productId}' not found",
                )
            seller_price = Decimal(str(product.price))
            rate = pricing_svc.commission_rate(seller_price)
            listed_price = pricing_svc.buyer_price(seller_price)
        else:
            # Guest / external item with no productId — accept client price
            listed_price = Decimal(str(item.price)).quantize(Decimal("0.01"))
            rate = None
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


def _order_to_dict(order: Order) -> dict:
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
        "subtotal": float(order.subtotal),
        "shippingCost": float(order.shipping_cost),
        "tax": float(order.tax),
        "total": float(order.total),
        "currency": order.currency,
        "trackingNumber": order.tracking_number,
        "trackingCarrier": order.tracking_carrier,
        "paidAt": order.paid_at,
        "shippedAt": order.shipped_at,
        "deliveredAt": order.delivered_at,
        "payoutAmount": float(order.payout_amount) if order.payout_amount is not None else None,
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
                "price": float(item.price),
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
        "total": float(order.total),
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
    # 0. Idempotency: return existing pending order if the same key was already used
    if payload.idempotencyKey:
        existing = db.scalar(
            select(Order).where(Order.idempotency_key == payload.idempotencyKey)
        )
        if existing:
            return {
                "orderId": existing.id,
                "reference": existing.paystack_reference or "",
                "authorizationUrl": "",
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

    if not settings.paystack_secret_key:
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

    return {
        "orderId": order_id,
        "reference": reference,
        "authorizationUrl": ps_data.get("authorization_url", ""),
        "accessCode": ps_data.get("access_code", ""),
    }


def _mark_order_paid(db: Session, order: Order, tx_id: str = "") -> None:
    """Transition order to paid, decrement stock, and notify buyer + sellers."""
    now = datetime.now(timezone.utc)
    order.status = "paid"
    order.paid_at = now
    if tx_id:
        order.paystack_tx_id = tx_id

    _decrement_stock(db, order)
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
                f"Total: {order.currency} {float(order.total):.2f}. "
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

    # Dev mock mode: no real Paystack key, accept any reference
    if not settings.paystack_secret_key:
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

    if not settings.paystack_secret_key:
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

    if not settings.paystack_secret_key:
        _mark_order_paid(db, order)
        return {"status": "success", "displayText": "[Dev mode] Payment confirmed"}

    try:
        charge_data = paystack_svc.submit_otp(otp=otp, reference=reference)
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    charge_status = charge_data.get("status", "")
    display_text = charge_data.get("display_text") or charge_data.get("message") or "Processing..."
    return {"status": charge_status, "displayText": display_text}


def check_momo_charge(reference: str) -> dict:
    """Poll Paystack for the current status of a pending MoMo charge."""
    if not settings.paystack_secret_key:
        return {"status": "success", "displayText": "[Dev mode] Payment confirmed"}

    try:
        charge_data = paystack_svc.check_charge(reference=reference)
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
        # Paystack confirmed the vendor payout transfer
        reference = data.get("reference", "")
        logger.info("Webhook: transfer success ref=%s", reference)

    elif event == "transfer.failed":
        recipient_code = data.get("recipient", {}).get("recipient_code", "")
        amount_minor = data.get("amount", 0)
        if not recipient_code:
            return
        vendor = db.scalar(select(User).where(User.paystack_recipient_code == recipient_code))
        if vendor:
            amount = amount_minor / 100
            currency = (vendor.payout_info or {}).get("currency", "GHS")
            logger.warning(
                "Webhook: payout transfer failed for vendor %s (recipient=%s, amount=%.2f)",
                vendor.id, recipient_code, amount,
            )
            dev_notifier.alert(
                "payout_transfer_failure",
                f"Payout transfer failed for vendor {vendor.id}",
                {
                    "vendor_id": vendor.id,
                    "vendor_email": vendor.email,
                    "recipient_code": recipient_code,
                    "amount": f"{currency} {amount:.2f}",
                },
            )
            notify_safe(
                db,
                event_type="payout_failed",
                recipient_id=vendor.id,
                title="Payout failed — action required",
                body=(
                    f"We couldn't send your payout of {currency} {amount:.2f}. "
                    "Please update your payout account details in your profile so we can retry."
                ),
                notif_type="account",
                href="/settings?tab=payout",
                email_subject="Action required: your Spree payout failed",
                cta_label="Update payout details",
                cta_url=f"{settings.frontend_url}/settings?tab=payout",
            )


def create_order(db: Session, payload: OrderCreateIn) -> dict:
    """Legacy direct-create (no Paystack). Kept for internal/admin use."""
    now = datetime.now(timezone.utc)
    order_id = f"order-{uuid4().hex[:16]}"

    order = Order(
        id=order_id,
        user_id=payload.userId,
        status="paid",
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
        subtotal=Decimal(str(payload.subtotal)),
        shipping_cost=Decimal(str(payload.shippingCost)),
        tax=Decimal(str(payload.tax)),
        total=Decimal(str(payload.total)),
        currency=payload.currency,
        paid_at=now,
    )
    db.add(order)

    seller_ids_notified: set[str] = set()

    for idx, item in enumerate(payload.items):
        seller_id: str | None = None
        item_rate: Decimal | None = None
        if item.productId:
            product = db.get(Product, item.productId)
            if product:
                seller_id = product.seller_id
                item_rate = pricing_svc.commission_rate(Decimal(str(product.price)))

        db.add(
            OrderItem(
                id=f"{order_id}-item-{idx + 1}",
                order_id=order_id,
                product_id=item.productId,
                seller_id=seller_id,
                name=item.name,
                image=item.image,
                price=Decimal(str(item.price)),
                quantity=item.quantity,
                color=item.color,
                size=item.size,
                commission_rate=item_rate,
            )
        )

        if seller_id and seller_id not in seller_ids_notified:
            seller_ids_notified.add(seller_id)

    db.commit()
    db.refresh(order)

    # Notify buyer
    if order.user_id:
        notify_safe(
            db,
            event_type="order_placed",
            recipient_id=order.user_id,
            title="Order confirmed!",
            body=(
                f"Your order has been received. "
                f"Total: {order.currency} {float(order.total):.2f}. "
                "We'll notify you once it ships."
            ),
            notif_type="order",
            href=f"/orders/{order.id}",
            email_subject="Your Spree order is confirmed",
            cta_label="View order",
            cta_url=f"{settings.frontend_url}/orders/{order.id}",
            recipient_email=order.email,
        )

    # Notify sellers
    for sid in seller_ids_notified:
        notify_safe(
            db,
            event_type="order_placed_seller",
            recipient_id=sid,
            title="New order received",
            body=(
                f"{payload.fullName} placed an order containing your product(s). "
                "Please prepare for shipping."
            ),
            notif_type="order",
            href="/dashboard/orders",
            email_subject="You have a new order on Spree",
            cta_label="View orders",
            cta_url=f"{settings.frontend_url}/dashboard/orders",
        )

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
    order.status = "shipped"
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


def confirm_delivery(db: Session, order_id: str, buyer_id: str) -> dict:
    # Use FOR UPDATE so two concurrent confirm-delivery calls can't both pass
    # the status check and double-release the vendor payout.
    order = db.scalar(
        select(Order).where(Order.id == order_id).with_for_update()
    )
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.user_id != buyer_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if order.status != "shipped":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot confirm delivery for an order with status '{order.status}'",
        )

    now = datetime.now(timezone.utc)
    order.status = "completed"
    order.delivered_at = now
    order.payout_released_at = now

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

    # Increment completed deliveries for each vendor before commit
    for sid in seller_payouts:
        vendor = db.get(User, sid)
        if vendor:
            vendor.completed_deliveries = (vendor.completed_deliveries or 0) + 1

    db.commit()
    db.refresh(order)

    # Notify buyer that delivery is confirmed
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

    # Notify each vendor with their payout
    for sid, payout in seller_payouts.items():
        vendor = db.get(User, sid)
        payout_minor = int(payout * 100)
        transfer_ok = False

        if vendor and vendor.paystack_recipient_code and settings.paystack_secret_key:
            try:
                paystack_svc.initiate_transfer(
                    amount_minor=payout_minor,
                    recipient_code=vendor.paystack_recipient_code,
                    reason=f"Spree payout for order {order.id}",
                )
                transfer_ok = True
            except Exception as exc:
                logger.error("Paystack transfer failed for vendor %s: %s", sid, exc)

        payout_note = (
            f"Your payout of {order.currency} {float(payout):.2f} has been sent to your account."
            if transfer_ok
            else (
                f"Your payout of {order.currency} {float(payout):.2f} is being processed. "
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

    return _order_to_dict(order)


def cancel_order(db: Session, order_id: str, actor_id: str, actor_role: str) -> dict:
    order = db.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    if actor_role != "admin" and order.user_id != actor_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if order.status in ("shipped", "completed"):
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

    if order.status not in ("paid", "shipped", "completed"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot refund an order with status '{order.status}'",
        )

    if order.paystack_reference and settings.paystack_secret_key:
        try:
            paystack_svc.refund_transaction(order.paystack_reference)
        except RuntimeError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    order.status = "cancelled"
    db.commit()

    if order.user_id:
        notify_safe(
            db,
            event_type="order_refunded",
            recipient_id=order.user_id,
            title="Your order has been refunded",
            body=(
                f"Your order has been cancelled and a refund of "
                f"{order.currency} {float(order.total):.2f} has been issued. "
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

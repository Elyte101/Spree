import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Order, OrderItem, Product, User
from app.schemas.order import OrderCreateIn, OrderTrackingIn
from app.services import paystack as paystack_svc
from app.services.notifications import create_notification

logger = logging.getLogger(__name__)

# Buyers pay seller_price * 1.10; seller receives seller_price back on delivery.
_MARKUP = Decimal("1.10")


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


def _build_pending_order(db: Session, payload: OrderCreateIn, order_id: str) -> Order:
    """Create order items and the Order row in status='pending'. Does not commit."""
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
        subtotal=Decimal(str(payload.subtotal)),
        shipping_cost=Decimal(str(payload.shippingCost)),
        tax=Decimal(str(payload.tax)),
        total=Decimal(str(payload.total)),
        currency=payload.currency,
    )
    db.add(order)

    for idx, item in enumerate(payload.items):
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
                price=Decimal(str(item.price)),
                quantity=item.quantity,
                color=item.color,
                size=item.size,
            )
        )
    return order


def initialize_payment(db: Session, payload: OrderCreateIn, callback_url: str) -> dict:
    """
    Create a pending order and return a Paystack authorization URL.
    The order stays 'pending' until the webhook/verify confirms payment.
    """
    order_id = f"order-{uuid4().hex[:16]}"
    reference = f"spree-{order_id}-{uuid4().hex[:8]}"

    order = _build_pending_order(db, payload, order_id)
    order.paystack_reference = reference
    db.commit()
    db.refresh(order)

    if not settings.paystack_secret_key:
        # Dev mode: skip Paystack, return a fake URL pointing straight to verify
        return {
            "orderId": order_id,
            "reference": reference,
            "authorizationUrl": f"{callback_url}?reference={reference}&mock=1",
        }

    # Paystack expects amount in smallest currency unit (pesewas / cents)
    amount_minor = int(Decimal(str(payload.total)) * 100)
    try:
        ps_data = paystack_svc.initialize_transaction(
            amount_minor=amount_minor,
            email=payload.email.strip().lower(),
            reference=reference,
            currency=payload.currency,
            callback_url=callback_url,
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
    }


def _mark_order_paid(db: Session, order: Order, tx_id: str = "") -> None:
    """Transition order to paid and notify sellers."""
    now = datetime.now(timezone.utc)
    order.status = "paid"
    order.paid_at = now
    if tx_id:
        order.paystack_tx_id = tx_id

    seller_ids_notified: set[str] = set()
    for item in order.items:
        if item.seller_id and item.seller_id not in seller_ids_notified:
            seller_ids_notified.add(item.seller_id)
            create_notification(
                db,
                title="New order received",
                body=(
                    f"{order.full_name} placed an order containing your product(s). "
                    "Please prepare for shipping."
                ),
                notif_type="order",
                href="/dashboard/orders",
                recipient_id=item.seller_id,
            )
    db.commit()


def verify_payment(db: Session, reference: str) -> dict:
    """
    Called from the Paystack redirect callback page.
    Verifies with Paystack API, marks order paid if confirmed.
    """
    order = db.scalar(select(Order).where(Order.paystack_reference == reference))
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


def handle_paystack_webhook(db: Session, event: str, data: dict) -> None:
    """Process Paystack webhook events. Called only after signature is verified."""
    if event == "charge.success":
        reference = data.get("reference", "")
        if not reference:
            return
        order = db.scalar(select(Order).where(Order.paystack_reference == reference))
        if order and order.status == "pending":
            _mark_order_paid(db, order, tx_id=str(data.get("id", "")))
            logger.info("Webhook: marked order %s as paid (ref=%s)", order.id, reference)

    elif event == "transfer.success":
        # Paystack confirmed the seller payout transfer
        reference = data.get("reference", "")
        logger.info("Webhook: transfer success ref=%s", reference)


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
                price=Decimal(str(item.price)),
                quantity=item.quantity,
                color=item.color,
                size=item.size,
            )
        )

        if seller_id and seller_id not in seller_ids_notified:
            seller_ids_notified.add(seller_id)
            create_notification(
                db,
                title="New order received",
                body=(
                    f"{payload.fullName} placed an order containing your product(s). "
                    "Please prepare for shipping."
                ),
                notif_type="order",
                href="/dashboard/orders",
                recipient_id=seller_id,
            )

    db.commit()
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
    order = db.get(Order, order_id)
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

    if order.user_id:
        carrier_str = f" via {payload.carrier.strip()}" if payload.carrier.strip() else ""
        eta_str = (
            f" Estimated delivery: {order.estimated_delivery_days} day(s)."
            if order.estimated_delivery_days
            else ""
        )
        create_notification(
            db,
            title="Your order has shipped!",
            body=(
                f"Your order has been dispatched{carrier_str}. "
                f"Tracking: {payload.trackingNumber.strip()}.{eta_str}"
            ),
            notif_type="order",
            href=f"/orders/{order_id}",
            recipient_id=order.user_id,
        )

    db.commit()
    db.refresh(order)
    return _order_to_dict(order)


def confirm_delivery(db: Session, order_id: str, buyer_id: str) -> dict:
    order = db.get(Order, order_id)
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

    # Payout = listed_price / markup = seller's original price
    seller_payouts: dict[str, Decimal] = {}
    total_payout = Decimal("0")

    for item in order.items:
        item_payout = (
            Decimal(str(item.price)) / _MARKUP * item.quantity
        ).quantize(Decimal("0.01"))
        total_payout += item_payout
        if item.seller_id:
            seller_payouts[item.seller_id] = (
                seller_payouts.get(item.seller_id, Decimal("0")) + item_payout
            )

    order.payout_amount = total_payout

    for sid, payout in seller_payouts.items():
        seller = db.get(User, sid)
        payout_minor = int(payout * 100)
        transfer_ok = False

        if seller and seller.paystack_recipient_code and settings.paystack_secret_key:
            try:
                paystack_svc.initiate_transfer(
                    amount_minor=payout_minor,
                    recipient_code=seller.paystack_recipient_code,
                    reason=f"Spree payout for order {order_id}",
                )
                transfer_ok = True
            except Exception as exc:
                logger.error("Paystack transfer failed for seller %s: %s", sid, exc)

        payout_note = (
            f"Your payout of {order.currency} {float(payout):.2f} has been sent to your account."
            if transfer_ok
            else (
                f"Your payout of {order.currency} {float(payout):.2f} is being processed. "
                "Please ensure your payout details are up to date in your profile."
            )
        )
        create_notification(
            db,
            title="Delivery confirmed — payout released",
            body=f"The buyer confirmed receipt of their order. {payout_note}",
            notif_type="order",
            href="/dashboard/orders",
            recipient_id=sid,
        )
        if seller:
            seller.completed_deliveries = (seller.completed_deliveries or 0) + 1

    db.commit()
    db.refresh(order)
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
    return _order_to_dict(order)

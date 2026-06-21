from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import ActorRole, ActorUserId, DBSession, InternalAPIKey
from app.schemas.order import (
    OrderCreateIn,
    OrderListItemOut,
    OrderOut,
    OrderTrackingIn,
)
from app.services.orders import (
    add_tracking,
    cancel_order,
    confirm_delivery,
    create_order,
    get_order,
    list_admin_orders,
    list_seller_orders,
    list_user_orders,
)

router = APIRouter()


@router.post("/orders", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def orders_create(
    payload: OrderCreateIn,
    db: DBSession,
    _: InternalAPIKey,
    actor_role: ActorRole,
):
    if actor_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create paid orders directly. Use /payments/initialize instead.",
        )
    return create_order(db, payload)


@router.get("/orders", response_model=list[OrderListItemOut])
def orders_list(
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
    actor_role: ActorRole,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
):
    if actor_role == "admin":
        return list_admin_orders(db, page, limit)
    if actor_id:
        return list_user_orders(db, actor_id)
    return []


@router.get("/vendor/orders", response_model=list[OrderListItemOut])
def seller_orders_list(db: DBSession, _: InternalAPIKey, actor_id: ActorUserId):
    if not actor_id:
        return []
    return list_seller_orders(db, actor_id)


@router.get("/orders/{order_id}", response_model=OrderOut)
def orders_detail(
    order_id: str,
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
    actor_role: ActorRole,
):
    return get_order(db, order_id, actor_id, actor_role)


@router.put("/orders/{order_id}/track", response_model=OrderOut)
def orders_add_tracking(
    order_id: str,
    payload: OrderTrackingIn,
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
):
    if not actor_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return add_tracking(db, order_id, payload, actor_id)


@router.put("/orders/{order_id}/confirm-delivery", response_model=OrderOut)
def orders_confirm_delivery(
    order_id: str,
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
):
    if not actor_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return confirm_delivery(db, order_id, actor_id)


@router.put("/orders/{order_id}/cancel", response_model=OrderOut)
def orders_cancel(
    order_id: str,
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
    actor_role: ActorRole,
):
    if not actor_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return cancel_order(db, order_id, actor_id, actor_role)

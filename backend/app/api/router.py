from fastapi import APIRouter

from app.api.routes import auth, cart, catalog, chat, cron, identity, marketplace, notifications, orders, payments, push

api_router = APIRouter()
api_router.include_router(catalog.router, tags=["catalog"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(cart.router, tags=["cart"])
api_router.include_router(chat.router, tags=["chat"])
api_router.include_router(cron.router, tags=["cron"])
api_router.include_router(marketplace.router, tags=["marketplace"])
api_router.include_router(notifications.router, tags=["notifications"])
# payments MUST come before orders: FastAPI uses first-match routing, and
# GET /orders/{order_id} in orders.router would otherwise shadow the static
# GET /orders/verify-payment and GET /orders/check-charge in payments.router.
api_router.include_router(payments.router, tags=["payments"])
api_router.include_router(orders.router, tags=["orders"])
api_router.include_router(push.router, tags=["push"])
api_router.include_router(identity.router, tags=["identity"])

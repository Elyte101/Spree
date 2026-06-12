from fastapi import APIRouter

from app.api.routes import auth, cart, catalog, cron, marketplace, notifications, orders, payments, push

api_router = APIRouter()
api_router.include_router(catalog.router, tags=["catalog"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(cart.router, tags=["cart"])
api_router.include_router(cron.router, tags=["cron"])
api_router.include_router(marketplace.router, tags=["marketplace"])
api_router.include_router(notifications.router, tags=["notifications"])
api_router.include_router(orders.router, tags=["orders"])
api_router.include_router(payments.router, tags=["payments"])
api_router.include_router(push.router, tags=["push"])

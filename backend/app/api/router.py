from fastapi import APIRouter

from app.api.routes import auth, cart, catalog, notifications

api_router = APIRouter()
api_router.include_router(catalog.router, tags=["catalog"])
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(cart.router, tags=["cart"])
api_router.include_router(notifications.router, tags=["notifications"])

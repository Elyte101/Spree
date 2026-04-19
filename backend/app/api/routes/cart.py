from fastapi import APIRouter

from app.api.deps import DBSession
from app.schemas.cart import CartSummaryOut
from app.services.cart import get_cart_summary

router = APIRouter()


@router.get("/cart", response_model=CartSummaryOut)
def cart_summary(db: DBSession):
    return get_cart_summary(db)


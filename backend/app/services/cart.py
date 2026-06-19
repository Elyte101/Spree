from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core import pricing
from app.core.config import settings
from app.db.models import Cart


def get_cart_summary(db: Session) -> dict:
    cart = db.scalar(select(Cart).options(selectinload(Cart.items)).limit(1))

    if cart is None:
        return {
            "id": "cart-guest",
            "items": [],
            "itemCount": 0,
            "subtotal": 0.0,
            "shipping": 0.0,
            "standardShipping": settings.default_shipping_rate,
            "tax": 0.0,
            "total": 0.0,
            "currency": "GHS",
        }

    items = [
        {
            "id": item.id,
            "productId": item.product_id,
            "name": item.name,
            "image": item.image,
            "price": float(item.price),
            "quantity": item.quantity,
            "color": item.color,
            "size": item.size,
            "isPreorder": item.is_preorder,
        }
        for item in cart.items
    ]

    _q = Decimal("0.01")
    subtotal = sum(
        Decimal(str(item["price"])) * item["quantity"] for item in items
    ).quantize(_q)
    std_shipping = Decimal(str(float(cart.standard_shipping)))
    shipping = Decimal("0") if not items else std_shipping
    tax = pricing.calc_processing_fee(subtotal) if items else Decimal("0")
    total = (subtotal + shipping + tax).quantize(_q)

    return {
        "id": cart.id,
        "items": items,
        "itemCount": sum(item["quantity"] for item in items),
        "subtotal": float(subtotal),
        "shipping": float(shipping),
        "standardShipping": float(cart.standard_shipping),
        "tax": float(tax),
        "total": float(total),
        "currency": cart.currency,
    }


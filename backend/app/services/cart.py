from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

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
            "currency": "USD",
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

    subtotal = round(sum(item["price"] * item["quantity"] for item in items), 2)
    shipping = 0.0 if not items or subtotal >= settings.free_shipping_threshold else float(cart.standard_shipping)
    tax = 0.0 if not items else round(subtotal * 0.08, 2)
    total = round(subtotal + shipping + tax, 2)

    return {
        "id": cart.id,
        "items": items,
        "itemCount": sum(item["quantity"] for item in items),
        "subtotal": subtotal,
        "shipping": shipping,
        "standardShipping": float(cart.standard_shipping),
        "tax": tax,
        "total": total,
        "currency": cart.currency,
    }


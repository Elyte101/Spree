from pydantic import BaseModel


class CartItemOut(BaseModel):
    id: str
    productId: str | None = None
    name: str
    image: str
    price: float
    quantity: int
    color: str | None = None
    size: str | None = None
    isPreorder: bool | None = None


class CartSummaryOut(BaseModel):
    id: str
    items: list[CartItemOut]
    itemCount: int
    subtotal: float
    shipping: float
    standardShipping: float
    tax: float
    total: float
    currency: str


"""
Seed catalog data: categories, brands, collections, and 20 starter products.

Usage (from backend/ dir):
    python -m app.seeds.catalog

Set DATABASE_URL env var to point at the target database.
Idempotent — safe to run multiple times; existing rows are skipped by slug.
"""
from __future__ import annotations

import logging
import sys
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select

# ---------------------------------------------------------------------------
# Bootstrap: make sure the app package is importable when run directly
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.db.models import Brand, Category, Collection, Product
from app.db.session import SessionLocal

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------
PLACEHOLDER = "https://placehold.co/600x600/655AFF/FFFFFF?text=Spree"

CATEGORIES = [
    {"id": "cat-fashion", "name": "Fashion & Apparel", "slug": "fashion", "image": PLACEHOLDER},
    {"id": "cat-electronics", "name": "Electronics", "slug": "electronics", "image": PLACEHOLDER},
    {"id": "cat-beauty", "name": "Beauty & Personal Care", "slug": "beauty", "image": PLACEHOLDER},
    {"id": "cat-home", "name": "Home & Living", "slug": "home", "image": PLACEHOLDER},
    {"id": "cat-food", "name": "Food & Groceries", "slug": "food", "image": PLACEHOLDER},
    {"id": "cat-sports", "name": "Sports & Fitness", "slug": "sports", "image": PLACEHOLDER},
]

BRANDS = [
    {"id": "brand-kente", "name": "Kente Couture", "slug": "kente-couture", "logo": PLACEHOLDER},
    {"id": "brand-accra", "name": "Accra Tech", "slug": "accra-tech", "logo": PLACEHOLDER},
    {"id": "brand-kumasi", "name": "Kumasi Craft", "slug": "kumasi-craft", "logo": PLACEHOLDER},
    {"id": "brand-tarkwa", "name": "Tarkwa Gold", "slug": "tarkwa-gold", "logo": PLACEHOLDER},
    {"id": "brand-adinkra", "name": "Adinkra Living", "slug": "adinkra-living", "logo": PLACEHOLDER},
    {"id": "brand-nkrumah", "name": "Nkrumah Foods", "slug": "nkrumah-foods", "logo": PLACEHOLDER},
    {"id": "brand-volta", "name": "Volta Fitness", "slug": "volta-fitness", "logo": PLACEHOLDER},
    {"id": "brand-elmina", "name": "Elmina Naturals", "slug": "elmina-naturals", "logo": PLACEHOLDER},
]

COLLECTIONS = [
    {"id": "col-new", "name": "New Arrivals", "slug": "new-arrivals", "description": "The latest additions to Spree.", "image": PLACEHOLDER},
    {"id": "col-sale", "name": "On Sale", "slug": "on-sale", "description": "Great deals across all categories.", "image": PLACEHOLDER},
    {"id": "col-featured", "name": "Editor's Picks", "slug": "editors-picks", "description": "Curated by the Spree team.", "image": PLACEHOLDER},
]

PRODUCTS = [
    # Fashion
    {
        "slug": "ankara-print-dress", "name": "Ankara Print Wrap Dress",
        "description": "Vibrant wax-print wrap dress in 100% cotton. Handmade in Accra by skilled seamstresses. Available in sizes S–XL.",
        "price": 149.00, "discount": 0, "category_id": "cat-fashion", "brand_id": "brand-kente",
        "collection_id": "col-featured", "stock": 40, "rating": 4.8, "reviews_count": 24,
        "purchase_count": 67, "is_featured": True, "tags": ["featured", "new-arrival", "ankara"],
        "badge": "Bestseller",
    },
    {
        "slug": "kente-tote-bag", "name": "Handwoven Kente Tote Bag",
        "description": "Authentic kente-strip tote bag woven by Bonwire artisans. Strong canvas lining, zip closure.",
        "price": 89.00, "discount": 10, "category_id": "cat-fashion", "brand_id": "brand-kente",
        "collection_id": "col-sale", "stock": 25, "rating": 4.6, "reviews_count": 18,
        "purchase_count": 42, "is_featured": False, "tags": ["sale", "kente", "accessories"],
        "badge": "Sale",
    },
    {
        "slug": "batakari-shirt-mens", "name": "Men's Batakari Smock Shirt",
        "description": "Northern Ghana hand-spun batakari shirt in earth tones. Ideal for smart-casual occasions.",
        "price": 115.00, "discount": 0, "category_id": "cat-fashion", "brand_id": "brand-kente",
        "collection_id": None, "stock": 30, "rating": 4.7, "reviews_count": 11,
        "purchase_count": 29, "is_featured": False, "tags": ["batakari", "mens"],
        "badge": None,
    },
    # Electronics
    {
        "slug": "wireless-earbuds-pro", "name": "AccraTech Pro Wireless Earbuds",
        "description": "True wireless earbuds with active noise cancellation, 28 hr battery life, and IPX5 water resistance.",
        "price": 299.00, "discount": 15, "category_id": "cat-electronics", "brand_id": "brand-accra",
        "collection_id": "col-sale", "stock": 60, "rating": 4.5, "reviews_count": 52,
        "purchase_count": 134, "is_featured": True, "tags": ["featured", "sale", "audio"],
        "badge": "Hot Deal",
    },
    {
        "slug": "solar-power-bank", "name": "Solar Power Bank 20,000 mAh",
        "description": "Dual solar panel power bank. Charges via sun or USB-C. Perfect for Ghana's sunny weather.",
        "price": 199.00, "discount": 0, "category_id": "cat-electronics", "brand_id": "brand-accra",
        "collection_id": "col-new", "stock": 45, "rating": 4.3, "reviews_count": 31,
        "purchase_count": 88, "is_featured": False, "tags": ["new-arrival", "solar", "power"],
        "badge": "New",
    },
    {
        "slug": "smart-watch-gt3", "name": "GT3 Smart Watch",
        "description": "Health tracking smartwatch with blood oxygen, heart rate, GPS, and 7-day battery. Compatible with Android & iOS.",
        "price": 349.00, "discount": 0, "category_id": "cat-electronics", "brand_id": "brand-accra",
        "collection_id": "col-featured", "stock": 20, "rating": 4.4, "reviews_count": 19,
        "purchase_count": 55, "is_featured": True, "tags": ["featured", "wearable"],
        "badge": None,
    },
    # Beauty
    {
        "slug": "shea-butter-cream", "name": "Unrefined Shea Butter Body Cream",
        "description": "Raw, unrefined shea butter sourced from northern Ghana. Deep moisturising. 250 ml glass jar.",
        "price": 45.00, "discount": 0, "category_id": "cat-beauty", "brand_id": "brand-elmina",
        "collection_id": "col-featured", "stock": 120, "rating": 4.9, "reviews_count": 78,
        "purchase_count": 210, "is_featured": True, "tags": ["featured", "natural", "skincare"],
        "badge": "Top Rated",
    },
    {
        "slug": "black-soap-bar", "name": "Authentic Ghanaian Black Soap 300g",
        "description": "Handmade with plantain ash, cocoa pod, and palm oil. Gentle cleanser for all skin types.",
        "price": 28.00, "discount": 0, "category_id": "cat-beauty", "brand_id": "brand-elmina",
        "collection_id": None, "stock": 200, "rating": 4.7, "reviews_count": 64,
        "purchase_count": 175, "is_featured": False, "tags": ["natural", "soap"],
        "badge": None,
    },
    {
        "slug": "argan-hair-oil", "name": "Pure Argan & Coconut Hair Oil",
        "description": "Fortifying hair oil blend for natural and relaxed hair. Reduces breakage and adds shine. 100 ml.",
        "price": 55.00, "discount": 20, "category_id": "cat-beauty", "brand_id": "brand-elmina",
        "collection_id": "col-sale", "stock": 80, "rating": 4.6, "reviews_count": 41,
        "purchase_count": 93, "is_featured": False, "tags": ["sale", "haircare", "natural"],
        "badge": "20% Off",
    },
    # Home & Living
    {
        "slug": "kente-throw-pillow", "name": "Kente-Inspired Throw Pillow Set (2)",
        "description": "Set of two 18\" throw pillows with kente-pattern jacquard covers. Includes inserts.",
        "price": 110.00, "discount": 0, "category_id": "cat-home", "brand_id": "brand-adinkra",
        "collection_id": "col-featured", "stock": 35, "rating": 4.5, "reviews_count": 16,
        "purchase_count": 38, "is_featured": False, "tags": ["featured", "home-decor", "kente"],
        "badge": None,
    },
    {
        "slug": "brass-adinkra-wall-art", "name": "Brass Adinkra Symbol Wall Art",
        "description": "Hand-cast brass wall plaque featuring the Gye Nyame adinkra symbol. 30 cm × 30 cm.",
        "price": 185.00, "discount": 0, "category_id": "cat-home", "brand_id": "brand-kumasi",
        "collection_id": None, "stock": 15, "rating": 4.8, "reviews_count": 9,
        "purchase_count": 21, "is_featured": False, "tags": ["wall-art", "brass", "artisan"],
        "badge": "Handmade",
    },
    {
        "slug": "rattan-storage-basket", "name": "Bolgatanga Rattan Storage Basket",
        "description": "Hand-woven basket from Bolgatanga using natural elephant grass. Perfect for storage or display. Medium size.",
        "price": 75.00, "discount": 0, "category_id": "cat-home", "brand_id": "brand-adinkra",
        "collection_id": "col-new", "stock": 50, "rating": 4.6, "reviews_count": 22,
        "purchase_count": 49, "is_featured": False, "tags": ["new-arrival", "woven", "storage"],
        "badge": "New",
    },
    # Food & Groceries
    {
        "slug": "sugarloaf-pineapple-chips", "name": "Dried Sugarloaf Pineapple Chips 200g",
        "description": "Sun-dried slices from Ghana's famous sugarloaf pineapple. No added sugar or preservatives.",
        "price": 22.00, "discount": 0, "category_id": "cat-food", "brand_id": "brand-nkrumah",
        "collection_id": "col-new", "stock": 150, "rating": 4.9, "reviews_count": 88,
        "purchase_count": 290, "is_featured": True, "tags": ["featured", "new-arrival", "snack"],
        "badge": "Fan Favourite",
    },
    {
        "slug": "red-palm-oil-1l", "name": "Unrefined Red Palm Oil 1L",
        "description": "Cold-pressed, unrefined red palm oil from Ashanti Region. Rich in beta-carotene and Vitamin E.",
        "price": 35.00, "discount": 0, "category_id": "cat-food", "brand_id": "brand-nkrumah",
        "collection_id": None, "stock": 200, "rating": 4.7, "reviews_count": 55,
        "purchase_count": 185, "is_featured": False, "tags": ["pantry", "palm-oil"],
        "badge": None,
    },
    {
        "slug": "groundnut-paste-500g", "name": "Roasted Groundnut Paste 500g",
        "description": "Smooth roasted groundnut paste, made in small batches. No palm oil or additives. Use for soups or spreads.",
        "price": 28.00, "discount": 0, "category_id": "cat-food", "brand_id": "brand-nkrumah",
        "collection_id": None, "stock": 180, "rating": 4.8, "reviews_count": 43,
        "purchase_count": 142, "is_featured": False, "tags": ["pantry", "groundnut"],
        "badge": None,
    },
    # Sports & Fitness
    {
        "slug": "resistance-bands-set", "name": "Resistance Bands Set (5 levels)",
        "description": "Full set of 5 latex resistance bands from light to ultra-heavy. Includes carry bag and exercise guide.",
        "price": 65.00, "discount": 0, "category_id": "cat-sports", "brand_id": "brand-volta",
        "collection_id": "col-new", "stock": 90, "rating": 4.4, "reviews_count": 30,
        "purchase_count": 82, "is_featured": False, "tags": ["new-arrival", "fitness", "home-gym"],
        "badge": "New",
    },
    {
        "slug": "football-training-kit", "name": "Football Training Kit — Shirt + Shorts",
        "description": "Lightweight polyester training kit. Moisture-wicking. Available in XS–2XL. Order both items together.",
        "price": 95.00, "discount": 10, "category_id": "cat-sports", "brand_id": "brand-volta",
        "collection_id": "col-sale", "stock": 55, "rating": 4.3, "reviews_count": 24,
        "purchase_count": 61, "is_featured": False, "tags": ["sale", "football", "training"],
        "badge": "Sale",
    },
    {
        "slug": "yoga-mat-6mm", "name": "6mm Non-Slip Yoga Mat",
        "description": "Eco-friendly TPE yoga mat with alignment lines. Anti-slip texture on both sides. 183 cm × 61 cm.",
        "price": 85.00, "discount": 0, "category_id": "cat-sports", "brand_id": "brand-volta",
        "collection_id": None, "stock": 70, "rating": 4.5, "reviews_count": 17,
        "purchase_count": 45, "is_featured": False, "tags": ["yoga", "fitness"],
        "badge": None,
    },
    # Extra featured products
    {
        "slug": "gold-plated-anklet", "name": "24K Gold-Plated Anklet",
        "description": "Handcrafted 24K gold-plated anklet with Sankofa bird pendant. Gift-boxed. Adjustable 22–26 cm chain.",
        "price": 220.00, "discount": 0, "category_id": "cat-fashion", "brand_id": "brand-tarkwa",
        "collection_id": "col-featured", "stock": 12, "rating": 4.9, "reviews_count": 8,
        "purchase_count": 14, "is_featured": True, "tags": ["featured", "jewellery", "gold"],
        "badge": "Limited",
    },
    {
        "slug": "kolanut-candle", "name": "Kola Nut & Cedar Scented Candle 200g",
        "description": "Hand-poured soy wax candle with kola nut, cedarwood, and hints of almond. 40+ hour burn time.",
        "price": 62.00, "discount": 0, "category_id": "cat-home", "brand_id": "brand-adinkra",
        "collection_id": "col-new", "stock": 60, "rating": 4.7, "reviews_count": 13,
        "purchase_count": 27, "is_featured": False, "tags": ["new-arrival", "candle", "home-scent"],
        "badge": "New",
    },
]


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------

def _upsert_categories(session) -> None:
    for c in CATEGORIES:
        if session.scalar(select(Category).where(Category.slug == c["slug"])) is None:
            session.add(Category(**c))
            log.info("Added category: %s", c["name"])


def _upsert_brands(session) -> None:
    for b in BRANDS:
        if session.scalar(select(Brand).where(Brand.slug == b["slug"])) is None:
            session.add(Brand(**b))
            log.info("Added brand: %s", b["name"])


def _upsert_collections(session) -> None:
    for c in COLLECTIONS:
        if session.scalar(select(Collection).where(Collection.slug == c["slug"])) is None:
            session.add(Collection(**c))
            log.info("Added collection: %s", c["name"])


def _upsert_products(session) -> None:
    for p in PRODUCTS:
        if session.scalar(select(Product).where(Product.slug == p["slug"])) is None:
            now = datetime.now(timezone.utc)
            session.add(
                Product(
                    id=f"prod-{uuid4().hex[:12]}",
                    slug=p["slug"],
                    name=p["name"],
                    description=p["description"],
                    price=Decimal(str(p["price"])),
                    discount_percentage=Decimal(str(p["discount"])),
                    images=[PLACEHOLDER],
                    category_id=p["category_id"],
                    brand_id=p["brand_id"],
                    collection_id=p.get("collection_id"),
                    seller_id=None,
                    stock=p["stock"],
                    rating=p["rating"],
                    reviews_count=p["reviews_count"],
                    purchase_count=p["purchase_count"],
                    variants=[],
                    badge=p.get("badge"),
                    tags=p["tags"],
                    is_featured=p["is_featured"],
                    is_new_arrival="new-arrival" in p["tags"],
                    created_at=now,
                    updated_at=now,
                )
            )
            log.info("Added product: %s", p["name"])


def run() -> None:
    with SessionLocal() as session:
        log.info("Seeding categories…")
        _upsert_categories(session)
        session.flush()

        log.info("Seeding brands…")
        _upsert_brands(session)
        session.flush()

        log.info("Seeding collections…")
        _upsert_collections(session)
        session.flush()

        log.info("Seeding products…")
        _upsert_products(session)

        session.commit()
        log.info("Catalog seed complete.")


if __name__ == "__main__":
    run()

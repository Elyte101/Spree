"""Defines the 11 top-level "umbrella" categories that group the
marketplace's 24 original main categories, so the storefront only shows 11
chips instead of 24 — see backend/scripts/create_category_umbrellas.py.

Every one of the 24 existing main categories is reparented under exactly
one umbrella; nothing about an existing category's own name, slug, or
subcategories changes — only its parent_id. Two umbrellas ("Home & Living",
"Automotive") would otherwise collide with an existing main category's own
name/slug (Category.name and Category.slug are both globally unique) —
resolved by giving every umbrella name the emoji prefix the approved
taxonomy table used in the first place, which no existing category name has.

This file is the single source of truth for which slugs are umbrellas —
_validate_sizes (app/services/catalog.py) imports UMBRELLA_SLUGS to resolve
the correct size-taxonomy category for a product sitting under one of them.
"""

UMBRELLA_CATEGORIES = [
    {
        "name": "🛍️ Fashion",
        "slug": "fashion",
        "members": ["fashion-apparel", "shoes-footwear", "bags-accessories", "jewelry-watches", "fabrics-textiles"],
    },
    {
        "name": "📱 Electronics",
        "slug": "electronics",
        "members": ["phones-accessories", "electronics-gadgets", "tech"],
    },
    {
        "name": "🏠 Home & Living",
        "slug": "home-and-living",
        "members": ["home-living", "kitchen-dining", "office-supplies", "tools-hardware"],
    },
    {
        "name": "🍎 Groceries",
        "slug": "groceries",
        "members": ["food-groceries"],
    },
    {
        "name": "💄 Beauty & Health",
        "slug": "beauty-health",
        "members": ["beauty-personal-care", "health-wellness"],
    },
    {
        "name": "👶 Baby, Kids & Toys",
        "slug": "baby-kids-toys",
        "members": ["baby-kids", "toys-games"],
    },
    {
        "name": "🚗 Automotive",
        "slug": "automotive-group",
        "members": ["automotive"],
    },
    {
        "name": "🐶 Pets",
        "slug": "pets",
        "members": ["pet-supplies"],
    },
    {
        "name": "⚽ Sports & Outdoors",
        "slug": "sports-outdoors",
        "members": ["sports-fitness"],
    },
    {
        "name": "🌱 Agriculture",
        "slug": "agriculture",
        "members": ["agriculture-farming"],
    },
    {
        "name": "🎨 Hobbies & Entertainment",
        "slug": "hobbies-entertainment",
        "members": ["art-crafts", "music-instruments", "books-stationery"],
    },
]

UMBRELLA_SLUGS = frozenset(u["slug"] for u in UMBRELLA_CATEGORIES)

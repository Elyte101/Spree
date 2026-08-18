"""
One-off cleanup: variant.image values that aren't in the product's own
images[] gallery (e.g. iphone-17-air's variants all pointing at an image
absent from its gallery; apple-macbook-pro's variants referencing a .jpg
while the gallery holds only .pngs). create_product/update_product now
reject this going forward (see _build_variants in app/services/catalog.py —
a variant image outside images[] falls back to the lead image at write
time), but existing rows written before that validation existed can still
have it.

Repoints every orphaned variant.image to the product's lead image
(images[0]) — the same fallback the write-path validation uses, not a
guess at which gallery image was "meant." Does not add orphaned URLs to
the gallery instead: an image with no corresponding gallery entry has no
verified provenance (could be stale/broken/wrong), so silently promoting
it into the public-facing gallery is a bigger, less reversible change than
repointing the variant reference.

Run from the backend directory:
    python scripts/fix_orphaned_variant_images.py [--dry-run]
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from app.db.models import Product
from app.db.session import SessionLocal


def run(dry_run: bool = False) -> None:
    changed = 0

    with SessionLocal() as db:
        products = db.scalars(select(Product)).all()

        for product in products:
            variants = product.variants or []
            images = product.images or []
            if not variants or not images:
                continue

            lead_image = images[0]
            dirty = False
            for variant in variants:
                image = variant.get("image")
                if image and image not in images:
                    print(
                        f"  {'[DRY] ' if dry_run else ''}FIX  {product.name!r} ({product.slug}) "
                        f"variant {variant.get('label')!r}: {image!r} -> {lead_image!r}"
                    )
                    if not dry_run:
                        variant["image"] = lead_image
                        dirty = True
                    changed += 1

            if dirty and not dry_run:
                flag_modified(product, "variants")
                db.add(product)

        if not dry_run:
            db.commit()

    verb = "Would fix" if dry_run else "Fixed"
    print(f"\n{verb} {changed} orphaned variant image reference(s).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Repoint variant images that aren't in the product's own gallery.")
    parser.add_argument("--dry-run", action="store_true", help="Print changes without writing.")
    args = parser.parse_args()
    run(dry_run=args.dry_run)

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

Idempotent: once a variant.image is repointed to images[0], it's by
definition in images[], so a second run finds no more orphans for it.

Run from the backend directory:
    python scripts/fix_orphaned_variant_images.py             # dry-run (default)
    python scripts/fix_orphaned_variant_images.py --apply      # actually write
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend/ — for app.*
sys.path.insert(0, str(Path(__file__).resolve().parent))  # scripts/ — for _migration_lib

from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from _migration_lib import build_arg_parser, print_table, resolve_dry_run, summarize
from app.db.models import Product
from app.db.session import SessionLocal


def run(dry_run: bool = True) -> list[tuple[str, str, str, str]]:
    """Returns the list of (product, variant_label, before, after) rows."""
    rows: list[tuple[str, str, str, str]] = []

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
                    rows.append((product.name[:40], str(variant.get("label"))[:20], image, lead_image))
                    if not dry_run:
                        variant["image"] = lead_image
                        dirty = True

            if dirty and not dry_run:
                flag_modified(product, "variants")
                db.add(product)

        if not dry_run:
            db.commit()

    print_table(["product", "variant", "before", "after"], rows)
    summarize("Would fix", "Fixed", dry_run, len(rows), "orphaned variant image reference(s)")
    return rows


if __name__ == "__main__":
    parser = build_arg_parser("Repoint variant images that aren't in the product's own gallery.")
    args = parser.parse_args()
    run(dry_run=resolve_dry_run(args))

"""
Read-only pre-flight / post-flight check: reports current data drift across
every category the seven backend/scripts/ migrations cover, without
changing anything. Always runs in dry-run mode — there is no --apply for
this script, on purpose.

Run this BEFORE the migration sequence (to see what's there) and AFTER (to
confirm each step actually converged to zero). See run_production_migrations.md
for the full runbook this supports.

Run from the backend directory:
    python scripts/verify_data_integrity.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend/ — for app.*
sys.path.insert(0, str(Path(__file__).resolve().parent))  # scripts/ — for sibling scripts

import backfill_seller_store_identity
import fix_collection_typos
import fix_orphaned_variant_images
import normalize_product_subcategories
import normalize_variant_colors
import normalize_variant_sizes
import reconcile_product_stock
from _migration_lib import print_table

# (module, label) in the same order as run_production_migrations.md's steps.
_CHECKS = [
    (reconcile_product_stock, "1. Stock/variant drift"),
    (fix_orphaned_variant_images, "2. Orphaned variant images"),
    (normalize_variant_colors, "3. Non-canonical colors"),
    (normalize_variant_sizes, "4. Non-canonical sizes"),
    (normalize_product_subcategories, "5. Products at main-category level"),
    (fix_collection_typos, "6. Collection typos"),
    (backfill_seller_store_identity, "7. Missing store identity"),
]


def run() -> dict[str, int]:
    print("=" * 72)
    print("DATA INTEGRITY REPORT (read-only — nothing below was changed)")
    print("=" * 72)

    counts: dict[str, int] = {}
    for module, label in _CHECKS:
        print(f"\n--- {label} ({module.__name__}.py) ---")
        rows = module.run(dry_run=True)
        counts[label] = len(rows)

    print("\n" + "=" * 72)
    print("SUMMARY")
    print("=" * 72)
    summary_rows = [[label, str(count), "CLEAN" if count == 0 else "NEEDS MIGRATION"] for label, count in counts.items()]
    print_table(["check", "issues found", "status"], summary_rows)

    total = sum(counts.values())
    print(f"\n{total} total issue(s) across {len(_CHECKS)} check(s).")
    return counts


if __name__ == "__main__":
    run()

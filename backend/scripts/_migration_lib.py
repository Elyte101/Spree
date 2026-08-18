"""Shared helpers for the one-off backend/scripts/ data-migration scripts.

Every script in this directory follows the same contract:
  - Defaults to dry-run — a bare invocation writes nothing.
  - --apply is the only way to actually write.
  - --dry-run is accepted explicitly too (it's just the default either way).
  - run(dry_run) returns the list of change-rows it found/made — an empty
    list means "nothing to do," which is what a second run against
    already-fixed data must return (idempotency).
  - Output is one consistent aligned before/after table (print_table below),
    not ad-hoc prose lines that differ script to script.
"""

import argparse


def build_arg_parser(description: str) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without writing. This is the default even without this flag.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually write the changes. Without this flag the script always runs in dry-run mode.",
    )
    return parser


def resolve_dry_run(args: argparse.Namespace) -> bool:
    """--apply is the only way to opt into writing; dry-run is the default
    you get from no flags, --dry-run, or (deliberately) even --dry-run
    combined with --apply — apply must be unambiguous, not a tiebreak."""
    return not args.apply


def print_table(headers: list[str], rows: list[list[str]]) -> None:
    """Aligned before/after table. Every migration script uses this instead
    of ad-hoc per-line prose so output has one consistent shape."""
    if not rows:
        print("  (no changes)")
        return
    str_rows = [[str(cell) for cell in row] for row in rows]
    widths = [
        max(len(headers[i]), *(len(row[i]) for row in str_rows))
        for i in range(len(headers))
    ]
    header_line = "  ".join(headers[i].ljust(widths[i]) for i in range(len(headers)))
    print(header_line)
    print("-" * len(header_line))
    for row in str_rows:
        print("  ".join(row[i].ljust(widths[i]) for i in range(len(row))))


def summarize(verb_dry: str, verb_applied: str, dry_run: bool, count: int, noun: str) -> None:
    verb = verb_dry if dry_run else verb_applied
    print(f"\n{verb} {count} {noun}.")

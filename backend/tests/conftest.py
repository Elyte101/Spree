"""Pytest configuration — reset file-based SQLite DBs before each test session.

Without this, verified Ghana Card numbers from prior runs persist and cause
409 uniqueness conflicts in subsequent runs.
"""
import os
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[1]


def pytest_configure(config):
    # Always clean the default dev database.
    _delete_if_exists(_BACKEND_ROOT / "data" / "spree_store.db")

    # Also clean whichever SQLite file DATABASE_URL points to (e.g. test.db in CI).
    db_url = os.getenv("DATABASE_URL", "")
    if db_url.startswith("sqlite:///") and not db_url.startswith("sqlite:///:memory:"):
        db_file = Path(db_url.removeprefix("sqlite:///"))
        if not db_file.is_absolute():
            db_file = _BACKEND_ROOT / db_file
        _delete_if_exists(db_file)


def _delete_if_exists(path: Path) -> None:
    if path.exists():
        path.unlink()

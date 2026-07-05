"""Pytest configuration — reset the file-based SQLite DB before each test session.

Without this, verified Ghana Card numbers from prior runs persist and cause
409 uniqueness conflicts in subsequent runs.
"""
from pathlib import Path


def pytest_configure(config):
    db_path = Path(__file__).resolve().parents[1] / "data" / "spree_store.db"
    if db_path.exists():
        db_path.unlink()

"""Pytest configuration — reset file-based SQLite DBs before each test session.

Without this, verified Ghana Card numbers from prior runs persist and cause
409 uniqueness conflicts in subsequent runs.
"""
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parents[1]


def actor_token(user_id: str, role: str = "customer", session_issued_at: int | None = None) -> str:
    """A2: mint a signed actor token for tests, mirroring lib/actorToken.ts.

    Tests hit the FastAPI app directly (no Next proxy in front), so they need
    to produce the same X-Actor-Token the proxy would mint from a real
    session in order to exercise actor-scoped routes.

    `session_issued_at` (A10 follow-up) mirrors the `siat` claim
    lib/actorToken.ts embeds from session.user.sessionIssuedAt — omit it to
    test the "no claim present" backward-compat path.
    """
    import jwt
    from app.core.config import settings

    now = datetime.now(timezone.utc)
    claims = {
        "sub": user_id,
        "role": role,
        "iss": "spree-next-proxy",
        "aud": "spree-backend",
        "iat": now,
        # Generous expiry (unlike the 60s the real proxy mints) so a single
        # module-level token, e.g. ADMIN_HEADERS, stays valid for an
        # entire test run rather than expiring mid-suite.
        "exp": now + timedelta(hours=1),
    }
    if session_issued_at is not None:
        claims["siat"] = session_issued_at
    return jwt.encode(claims, settings.actor_token_secret, algorithm="HS256")


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

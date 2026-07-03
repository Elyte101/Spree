"""In-memory verification session cache.

Stores per-session state between the NIA lookup step and the face-verify step.
Sessions are keyed by a random UUID and expire after TTL_SECONDS (default 30 min).

Security properties:
  • NIA photo (photo_b64) is held server-side only — never sent to the browser.
  • Sessions are deleted immediately after face-verify completes (pass or fail).
  • Expired sessions are pruned lazily on access and by a background sweep.

Usage
-----
    from app.services.verification_session import verification_sessions

    session_id = verification_sessions.create(
        user_id="u123",
        id_number="GHA-000000000-1",
        full_name="KWAME MENSAH",
        dob="1990-01-15",
        gender="Male",
        photo_b64="<base64 NIA mugshot>",
    )
    session = verification_sessions.get(session_id)
    verification_sessions.delete(session_id)
"""
from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field

TTL_SECONDS = 30 * 60  # 30 minutes
_SWEEP_INTERVAL = 5 * 60  # prune expired sessions every 5 minutes


@dataclass
class VerificationSession:
    session_id: str
    user_id: str
    id_number: str      # encrypted Ghana Card number (Fernet)
    full_name: str
    dob: str            # ISO date YYYY-MM-DD
    gender: str
    photo_b64: str      # base64 NIA mugshot — server-side only, never exposed
    created_at: float = field(default_factory=time.monotonic)
    attempt_count: int = 0

    @property
    def is_expired(self) -> bool:
        return (time.monotonic() - self.created_at) > TTL_SECONDS


class VerificationSessionStore:
    """Thread-safe in-memory session store with TTL expiry."""

    def __init__(self) -> None:
        self._sessions: dict[str, VerificationSession] = {}
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def create(
        self,
        *,
        user_id: str,
        id_number: str,
        full_name: str,
        dob: str,
        gender: str,
        photo_b64: str,
    ) -> str:
        """Create a new session and return its UUID."""
        session_id = str(uuid.uuid4())
        session = VerificationSession(
            session_id=session_id,
            user_id=user_id,
            id_number=id_number,
            full_name=full_name,
            dob=dob,
            gender=gender,
            photo_b64=photo_b64,
        )
        with self._lock:
            self._sessions[session_id] = session
            self._maybe_sweep()
        return session_id

    def get(self, session_id: str) -> VerificationSession | None:
        """Return the session if it exists and has not expired."""
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return None
            if session.is_expired:
                del self._sessions[session_id]
                return None
            return session

    def get_by_user(self, user_id: str) -> VerificationSession | None:
        """Return the most-recent non-expired session for a user, if any."""
        with self._lock:
            candidates = [
                s for s in self._sessions.values()
                if s.user_id == user_id and not s.is_expired
            ]
        if not candidates:
            return None
        return max(candidates, key=lambda s: s.created_at)

    def delete(self, session_id: str) -> None:
        """Remove a session (called after face-verify completes)."""
        with self._lock:
            self._sessions.pop(session_id, None)

    def increment_attempt(self, session_id: str) -> int:
        """Increment attempt count and return the new value."""
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return 0
            session.attempt_count += 1
            return session.attempt_count

    def invalidate_user_sessions(self, user_id: str) -> None:
        """Remove all sessions for a user (e.g. on new lookup)."""
        with self._lock:
            stale = [sid for sid, s in self._sessions.items() if s.user_id == user_id]
            for sid in stale:
                del self._sessions[sid]

    def __len__(self) -> int:
        with self._lock:
            return len(self._sessions)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _maybe_sweep(self) -> None:
        """Prune expired sessions (called while holding the lock)."""
        now = time.monotonic()
        if now - self._last_sweep < _SWEEP_INTERVAL:
            return
        expired = [sid for sid, s in self._sessions.items() if s.is_expired]
        for sid in expired:
            del self._sessions[sid]
        self._last_sweep = now


verification_sessions = VerificationSessionStore()

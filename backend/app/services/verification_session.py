"""DB-backed identity verification session store.

Replaces the in-memory dict so sessions survive Vercel serverless invocation
boundaries (C4).  Sessions live in the `identity_sessions` table, expire after
TTL_SECONDS, and are deleted immediately after face-verify completes.

Security properties (unchanged from the in-memory version):
  • NIA photo (photo_b64) is held server-side only — never sent to the browser.
  • Sessions are deleted immediately after face-verify completes (pass or fail).
  • Expired sessions are filtered out on every read.

Usage
-----
    from app.services.verification_session import verification_sessions

    session_id = verification_sessions.create(
        db,
        user_id="u123",
        id_number="GHA-000000000-1",
        full_name="KWAME MENSAH",
        dob="1990-01-15",
        gender="Male",
        photo_b64="<base64 NIA mugshot>",
    )
    session = verification_sessions.get(db, session_id)
    verification_sessions.delete(db, session_id)
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import IdentitySession

TTL_SECONDS = 30 * 60  # 30 minutes


class VerificationSession:
    """Thin wrapper so identity.py attribute access (session.photo_b64 etc.) is unchanged."""

    def __init__(self, row: IdentitySession) -> None:
        self.session_id = row.session_id
        self.user_id = row.user_id
        self.id_number = row.id_number
        self.full_name = row.full_name
        self.dob = row.dob
        self.gender = row.gender
        self.photo_b64 = row.photo_b64
        self.attempt_count = row.attempt_count


class VerificationSessionStore:
    """DB-backed session store — same public API as the old in-memory store
    but every method now takes `db: Session` as its first argument."""

    def create(
        self,
        db: Session,
        *,
        user_id: str,
        id_number: str,
        full_name: str,
        dob: str,
        gender: str,
        photo_b64: str,
    ) -> str:
        """Create a new session and return its UUID."""
        session_id = str(uuid4())
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=TTL_SECONDS)
        row = IdentitySession(
            session_id=session_id,
            user_id=user_id,
            id_number=id_number,
            full_name=full_name,
            dob=dob,
            gender=gender,
            photo_b64=photo_b64,
            attempt_count=0,
            expires_at=expires_at,
        )
        db.add(row)
        db.commit()
        return session_id

    def get(self, db: Session, session_id: str) -> VerificationSession | None:
        """Return the session if it exists and has not expired."""
        now = datetime.now(timezone.utc)
        row = db.scalar(
            select(IdentitySession).where(
                IdentitySession.session_id == session_id,
                IdentitySession.expires_at > now,
            )
        )
        return VerificationSession(row) if row else None

    def get_by_user(self, db: Session, user_id: str) -> VerificationSession | None:
        """Return the most-recent non-expired session for a user, if any."""
        now = datetime.now(timezone.utc)
        row = db.scalar(
            select(IdentitySession)
            .where(
                IdentitySession.user_id == user_id,
                IdentitySession.expires_at > now,
            )
            .order_by(IdentitySession.created_at.desc())
        )
        return VerificationSession(row) if row else None

    def delete(self, db: Session, session_id: str) -> None:
        """Remove a session (called after face-verify completes)."""
        db.execute(
            delete(IdentitySession).where(IdentitySession.session_id == session_id)
        )
        db.commit()

    def increment_attempt(self, db: Session, session_id: str) -> int:
        """Increment attempt count and return the new value."""
        row = db.scalar(
            select(IdentitySession).where(IdentitySession.session_id == session_id)
        )
        if row is None:
            return 0
        row.attempt_count += 1
        db.commit()
        return row.attempt_count

    def invalidate_user_sessions(self, db: Session, user_id: str) -> None:
        """Remove all sessions for a user (e.g. on new NIA lookup)."""
        db.execute(
            delete(IdentitySession).where(IdentitySession.user_id == user_id)
        )
        db.commit()


verification_sessions = VerificationSessionStore()

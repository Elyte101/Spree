"""Admin audit log service.

Every admin action that mutates platform state should call ``log_action()``
so there is an immutable trail of who did what and when.

Usage
-----
    from app.services.audit import log_action
    log_action(db, actor_id=admin_id, action="seller.approve", target_type="user", target_id=seller_id)
"""

from __future__ import annotations

import logging
from uuid import uuid4

from sqlalchemy.orm import Session

from app.db.models import AuditLog

logger = logging.getLogger(__name__)


def log_action(
    db: Session,
    *,
    actor_id: str | None,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    payload: dict | None = None,
) -> AuditLog:
    """Append an immutable audit log entry.

    Parameters
    ----------
    actor_id:
        The admin (or system) user performing the action.
    action:
        Dot-namespaced action name, e.g. ``"seller.approve"``,
        ``"product.blacklist"``, ``"order.refund"``.
    target_type:
        The type of the target resource, e.g. ``"user"``, ``"product"``.
    target_id:
        The ID of the target resource.
    payload:
        Structured snapshot of what changed (before/after values,
        rejection reason, etc.).  Never include raw secrets here.
    """
    entry = AuditLog(
        id=f"audit-{uuid4().hex[:18]}",
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        payload=payload or {},
    )
    db.add(entry)
    logger.info(
        "[audit] actor=%s action=%s target_type=%s target_id=%s",
        actor_id,
        action,
        target_type,
        target_id,
    )
    return entry


def get_audit_log(
    db: Session,
    *,
    target_type: str | None = None,
    target_id: str | None = None,
    actor_id: str | None = None,
    limit: int = 100,
) -> list[dict]:
    """Return recent audit log entries, newest first."""
    q = db.query(AuditLog)
    if target_type:
        q = q.filter(AuditLog.target_type == target_type)
    if target_id:
        q = q.filter(AuditLog.target_id == target_id)
    if actor_id:
        q = q.filter(AuditLog.actor_id == actor_id)
    rows = q.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [_entry_to_dict(r) for r in rows]


def _entry_to_dict(entry: AuditLog) -> dict:
    return {
        "id": entry.id,
        "actorId": entry.actor_id,
        "action": entry.action,
        "targetType": entry.target_type,
        "targetId": entry.target_id,
        "payload": entry.payload or {},
        "createdAt": entry.created_at,
    }

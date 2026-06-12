"""
Notification service — single entry point for all notification events.

Call `notify(event_type, recipient_id, ...)` from any service; it:
  1. Creates an in-app Notification row
  2. Sends an email via Resend (if configured and recipient opted in)
  3. Sends a web push to all stored subscriptions (if configured and opted in)

New event types are added by extending EVENT_CONFIGS below.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Notification, PushSubscription, User

logger = logging.getLogger(__name__)

# ── Default notification preferences (all channels on for mandatory events) ───

DEFAULT_PREFS: dict[str, dict[str, bool]] = {
    "seller_created":           {"in_app": True,  "email": True,  "push": True},
    "docs_submitted":           {"in_app": True,  "email": True,  "push": False},
    "new_verification_pending": {"in_app": True,  "email": True,  "push": False},
    "seller_approved":          {"in_app": True,  "email": True,  "push": True},
    "seller_rejected":          {"in_app": True,  "email": True,  "push": True},
    "payout_saved":             {"in_app": True,  "email": True,  "push": False},
    "onboarding_reminder":      {"in_app": False, "email": True,  "push": True},
}

# Events that cannot be disabled by the user
MANDATORY_EVENTS = {"seller_approved", "seller_rejected"}


def _get_user_prefs(user: User | None, event_type: str) -> dict[str, bool]:
    defaults = DEFAULT_PREFS.get(event_type, {"in_app": True, "email": False, "push": False})
    if user is None or user.notification_prefs is None:
        return defaults
    user_event_prefs = user.notification_prefs.get(event_type, {})
    merged = {**defaults, **user_event_prefs}
    if event_type in MANDATORY_EVENTS:
        merged["email"] = True
    return merged


def _create_in_app(
    db: Session,
    recipient_id: str | None,
    title: str,
    body: str,
    notif_type: str,
    event_type: str | None,
    href: str | None,
) -> None:
    db.add(Notification(
        id=f"notif-{uuid4().hex[:16]}",
        recipient_id=recipient_id,
        title=title,
        body=body,
        created_at=datetime.now(timezone.utc),
        is_read=False,
        type=notif_type,
        href=href,
        event_type=event_type,
        channel="in_app",
        is_sent=True,
    ))


def _send_email(recipient_email: str, subject: str, html: str) -> None:
    if not settings.resend_api_key:
        logger.debug("Resend not configured; skipping email to %s", recipient_email)
        return
    try:
        import resend
        resend.api_key = settings.resend_api_key
        resend.Emails.send({
            "from": settings.email_from,
            "to": [recipient_email],
            "subject": subject,
            "html": html,
        })
    except Exception as exc:
        logger.warning("Failed to send email to %s: %s", recipient_email, exc)


def _send_push(db: Session, recipient_id: str, title: str, body: str, href: str | None) -> None:
    if not settings.vapid_private_key or not settings.vapid_public_key:
        logger.debug("VAPID keys not configured; skipping push for %s", recipient_id)
        return
    subs = db.scalars(
        select(PushSubscription).where(PushSubscription.user_id == recipient_id)
    ).all()
    if not subs:
        return
    try:
        from pywebpush import webpush, WebPushException
        import json as _json
        payload = _json.dumps({"title": title, "body": body, "href": href or "/"})
        for sub in subs:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                    },
                    data=payload,
                    vapid_private_key=settings.vapid_private_key,
                    vapid_claims={"sub": settings.vapid_subject},
                )
            except WebPushException as exc:
                logger.warning("Push failed for subscription %s: %s", sub.id, exc)
                if exc.response and exc.response.status_code in (404, 410):
                    db.delete(sub)
    except ImportError:
        logger.warning("pywebpush not installed; push notifications disabled")
    except Exception as exc:
        logger.warning("Unexpected push error: %s", exc)


def _email_html(title: str, body: str, cta_label: str | None = None, cta_url: str | None = None) -> str:
    cta_block = ""
    if cta_label and cta_url:
        cta_block = f"""
        <p style="margin:24px 0 0">
          <a href="{cta_url}" style="background:#655AFF;color:#fff;padding:12px 24px;
             border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">
            {cta_label}
          </a>
        </p>"""
    return f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 16px">
      <h1 style="font-size:24px;font-weight:900;color:#0f0a1e;margin:0 0 8px">
        <span style="color:#655AFF">Spree</span>
      </h1>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
      <h2 style="font-size:18px;font-weight:700;color:#0f0a1e;margin:0 0 12px">{title}</h2>
      <p style="color:#374151;line-height:1.6;margin:0">{body}</p>
      {cta_block}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px">
      <p style="font-size:12px;color:#9ca3af;margin:0">
        You're receiving this because you have a Spree account.
        Manage preferences in your <a href="{settings.frontend_url}/settings">account settings</a>.
      </p>
    </div>"""


# ── Public API ────────────────────────────────────────────────────────────────

def notify(
    db: Session,
    event_type: str,
    recipient_id: str | None,
    title: str,
    body: str,
    notif_type: str = "account",
    href: str | None = None,
    email_subject: str | None = None,
    cta_label: str | None = None,
    cta_url: str | None = None,
    recipient_email: str | None = None,
) -> None:
    recipient: User | None = None
    if recipient_id:
        recipient = db.get(User, recipient_id)

    prefs = _get_user_prefs(recipient, event_type)

    if prefs.get("in_app"):
        _create_in_app(db, recipient_id, title, body, notif_type, event_type, href)

    if prefs.get("email"):
        email = recipient_email or (recipient.email if recipient else None)
        if email:
            subject = email_subject or title
            html = _email_html(title, body, cta_label, cta_url or (
                f"{settings.frontend_url}{href}" if href else None
            ))
            _send_email(email, subject, html)

    if prefs.get("push") and recipient_id:
        _send_push(db, recipient_id, title, body, href)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise


# ── Backward-compatible helpers ───────────────────────────────────────────────

def create_notification(
    db: Session,
    title: str,
    body: str,
    notif_type: str,
    href: str | None = None,
    recipient_id: str | None = None,
) -> None:
    _create_in_app(db, recipient_id, title, body, notif_type, None, href)


def list_notifications(db: Session, recipient_id: str | None = None) -> list[dict[str, Any]]:
    if recipient_id:
        stmt = (
            select(Notification)
            .where(
                Notification.channel == "in_app",
                or_(
                    Notification.recipient_id == recipient_id,
                    Notification.recipient_id.is_(None),
                ),
            )
            .order_by(Notification.created_at.desc())
            .limit(100)
        )
    else:
        stmt = (
            select(Notification)
            .where(
                Notification.channel == "in_app",
                Notification.recipient_id.is_(None),
            )
            .order_by(Notification.created_at.desc())
            .limit(50)
        )

    rows = db.scalars(stmt).all()
    return [
        {
            "id": n.id,
            "title": n.title,
            "body": n.body,
            "createdAt": n.created_at.isoformat().replace("+00:00", "Z"),
            "isRead": n.is_read,
            "type": n.type,
            "href": n.href,
            "eventType": n.event_type,
            "channel": n.channel,
        }
        for n in rows
    ]


def get_unread_count(db: Session, recipient_id: str) -> int:
    from sqlalchemy import func as sqlfunc
    result = db.scalar(
        select(sqlfunc.count(Notification.id)).where(
            Notification.channel == "in_app",
            Notification.is_read.is_(False),
            or_(
                Notification.recipient_id == recipient_id,
                Notification.recipient_id.is_(None),
            ),
        )
    )
    return result or 0


def mark_notification_read(db: Session, notification_id: str, user_id: str) -> bool:
    n = db.get(Notification, notification_id)
    if n is None:
        return False
    if n.recipient_id is not None and n.recipient_id != user_id:
        return False
    n.is_read = True
    db.commit()
    return True


def mark_all_read(db: Session, user_id: str) -> None:
    db.execute(
        update(Notification)
        .where(
            Notification.channel == "in_app",
            Notification.is_read.is_(False),
            or_(
                Notification.recipient_id == user_id,
                Notification.recipient_id.is_(None),
            ),
        )
        .values(is_read=True)
    )
    db.commit()

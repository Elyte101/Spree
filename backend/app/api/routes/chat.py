"""
Chat routes — Stream Chat token issuance and webhook handler for AI auto-replies.

Routers exported:
  router          — mounted at /api/v1  (internal, requires X-Internal-Api-Key)
  webhook_router  — mounted at /        (public, verified via HMAC-SHA256)

GET  /chat/token           Requires internal API key + actor user id.
                           Returns a Stream Chat user token so the browser
                           client can connect.  Also upserts the Stream user
                           and joins them to their personal support channel.

POST /chat/admin-token     Returns a Stream Chat token for the admin user.
                           Used by the admin dashboard page.

POST /webhooks/stream      Public endpoint — called by Stream when a message
                           is sent.  Verified with HMAC-SHA256 signature.
                           If the sender is not the admin and no admin replied
                           in the last 60 s, Claude posts an AI reply inline.
"""
from __future__ import annotations

import datetime
import hashlib
import hmac
import json
import logging
import time
from collections import deque

from fastapi import APIRouter, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import ActorRole, ActorUserId, DBSession, InternalAPIKey, _check_rate_limit
from app.core.config import settings
from app.db.models import Order, User
from app.services.notifications import notify_safe

logger = logging.getLogger(__name__)

# Internal routes (sit behind /api/v1 + X-Internal-Api-Key)
router = APIRouter()

# Public webhook route (no auth, mounted directly at /)
webhook_router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _stream_client():
    """Return a StreamChat server-side client, or raise 503 if keys are missing."""
    api_key = getattr(settings, "stream_api_key", "") or ""
    api_secret = getattr(settings, "stream_api_secret", "") or ""
    if not api_key or not api_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stream Chat is not configured (STREAM_API_KEY / STREAM_API_SECRET missing).",
        )
    from stream_chat import StreamChat  # type: ignore[import-untyped]
    return StreamChat(api_key=api_key, api_secret=api_secret)


def _stream_api_exception():
    """Import StreamAPIException without polluting the module namespace on every call."""
    from stream_chat.base.exceptions import StreamAPIException  # type: ignore[import-untyped]
    return StreamAPIException


def _admin_user_id() -> str:
    return getattr(settings, "stream_admin_user_id", "") or "spree-admin"


# ---------------------------------------------------------------------------
# GET /chat/token
# ---------------------------------------------------------------------------

@router.get("/chat/token")
def chat_token(
    db: DBSession,
    _: InternalAPIKey,
    actor_id: ActorUserId,
    actor_role: ActorRole,
):
    """Issue a Stream Chat user token for the authenticated user.

    Token creation is a local JWT operation and never fails due to Stream API issues.
    User upsert and channel get-or-create are best-effort: errors are logged with the
    specific Stream error code, but the token is returned regardless so the frontend
    can still attempt to connect.
    """
    if not actor_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    api_key = getattr(settings, "stream_api_key", "") or ""
    api_secret = getattr(settings, "stream_api_secret", "") or ""
    if not api_key or not api_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stream Chat is not configured (STREAM_API_KEY / STREAM_API_SECRET missing).",
        )

    from stream_chat import StreamChat  # type: ignore[import-untyped]
    StreamAPIException = _stream_api_exception()

    client = StreamChat(api_key=api_key, api_secret=api_secret)
    admin_id = _admin_user_id()
    channel_id = f"support-{actor_id}"

    # M2: look up the user's real name so Stream shows "Kwame Mensah" not "user-abc123".
    user = db.get(User, actor_id)
    display_name = (user.name or actor_id) if user else actor_id

    # create_token is a local HMAC-signed JWT — never makes a network call.
    token = client.create_token(actor_id)

    # Upsert both Stream users so display names stay current.
    # Best-effort: a failure here doesn't prevent the client from connecting.
    try:
        client.upsert_user({"id": actor_id, "role": "user", "name": display_name})
        client.upsert_user({"id": admin_id, "role": "admin", "name": "Spree Support"})
    except StreamAPIException as exc:
        logger.warning(
            "chat_token: upsert_user failed for %s: Stream code=%s %r",
            actor_id, exc.error_code, exc.error_message,
        )
    except Exception as exc:
        logger.warning("chat_token: upsert_user unexpected error for %s: %s", actor_id, exc)

    # Get-or-create the support channel with both members so the admin can see it.
    # Best-effort: token is returned even if this fails (e.g. channel type not set up yet).
    # If this keeps failing, run: python backend/scripts/setup_stream.py
    try:
        ch = client.channel("support", channel_id, data={"members": [actor_id, admin_id]})
        ch.create(actor_id)
    except StreamAPIException as exc:
        logger.warning(
            "chat_token: channel.create failed for %s: Stream code=%s %r — "
            "if 'channel type does not exist', run backend/scripts/setup_stream.py",
            channel_id, exc.error_code, exc.error_message,
        )
    except Exception as exc:
        logger.warning("chat_token: channel.create unexpected error for %s: %s", channel_id, exc)

    return {
        "token": token,
        "userId": actor_id,
        "channelId": channel_id,
        "apiKey": api_key,
    }


# ---------------------------------------------------------------------------
# POST /chat/admin-token
# ---------------------------------------------------------------------------

@router.post("/chat/admin-token")
def chat_admin_token(_: InternalAPIKey, actor_role: ActorRole):
    """Issue a Stream Chat token for the admin user (used by the admin dashboard)."""
    if actor_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    StreamAPIException = _stream_api_exception()
    client = _stream_client()
    admin_id = _admin_user_id()

    # Local JWT — never fails due to Stream API.
    token = client.create_token(admin_id)

    # Best-effort upsert so the admin's Stream profile is current.
    try:
        client.upsert_user({"id": admin_id, "role": "admin", "name": "Spree Support"})
    except StreamAPIException as exc:
        logger.warning(
            "chat_admin_token: upsert_user failed: Stream code=%s %r",
            exc.error_code, exc.error_message,
        )
    except Exception as exc:
        logger.warning("chat_admin_token: upsert_user unexpected error: %s", exc)

    return {
        "token": token,
        "userId": admin_id,
        "apiKey": getattr(settings, "stream_api_key", ""),
    }


# ---------------------------------------------------------------------------
# POST /webhooks/stream  (mounted on webhook_router — no internal key required)
# ---------------------------------------------------------------------------

# CH12: deque(maxlen=1000) auto-trims oldest entry when full — no manual clear() needed.
# Best-effort only — cleared on cold starts — but prevents double-posts on warm retries.
_processed_message_ids: deque[str] = deque(maxlen=1000)


def _post_ai_reply(
    db: Session,
    message_id: str,
    message_text: str,
    sender_id: str,
    channel_id: str,
    channel_type: str,
) -> None:
    """Send a Claude AI reply to the channel. Called inline before the webhook returns."""
    admin_id = _admin_user_id()
    anthropic_key = getattr(settings, "anthropic_api_key", "") or ""
    if not anthropic_key:
        logger.info("_post_ai_reply: ANTHROPIC_API_KEY not set, skipping AI reply")
        return

    try:
        client = _stream_client()
        channel = client.channel(channel_type, channel_id)

        # Check for recent admin reply (within 60 s).
        state = channel.query({"messages": {"limit": 10}})
        messages: list = state.get("messages", [])

        now_ts = time.time()
        for msg in reversed(messages[:-1]):
            msg_sender_id = (msg.get("user") or {}).get("id", "")
            if msg_sender_id == admin_id:
                created_at_str = msg.get("created_at", "")
                if created_at_str:
                    try:
                        dt = datetime.datetime.fromisoformat(created_at_str.rstrip("Z"))
                        age_seconds = now_ts - dt.replace(tzinfo=datetime.timezone.utc).timestamp()
                        if age_seconds < 60:
                            logger.info("_post_ai_reply: admin replied recently, skipping AI")
                            return
                    except Exception:
                        pass
                break

        # Build conversation history (last 8 messages).
        history_msgs: list[dict] = []
        for msg in messages[-8:]:
            msg_sender_id = (msg.get("user") or {}).get("id", "")
            role = "assistant" if msg_sender_id in (admin_id, "spree-support") else "user"
            text = msg.get("text", "")
            if text:
                history_msgs.append({"role": role, "content": text})

        if not history_msgs or history_msgs[-1].get("content") != message_text:
            history_msgs.append({"role": "user", "content": message_text})

        if history_msgs and history_msgs[0]["role"] == "assistant":
            history_msgs = history_msgs[1:]
        if not history_msgs:
            history_msgs = [{"role": "user", "content": message_text}]

        user_id_from_channel = (
            channel_id.replace("support-", "", 1) if channel_id.startswith("support-") else sender_id
        )

        system_prompt = (
            "You are Spree Support, the helpful assistant for Spree — a Ghanaian online marketplace. "
            "You help buyers and sellers with orders, payments, delivery, and account issues. "
            "Be friendly, concise, and professional. Write in plain English (not Markdown). "
            "If you don't know something specific (like a particular order status), ask the user "
            "for their Order ID and tell them a human agent will follow up. "
            f"Current user ID: {user_id_from_channel}."
        )

        # CH13: append recent orders to system prompt so the bot can reference order details.
        try:
            recent_orders = db.scalars(
                select(Order)
                .where(Order.user_id == user_id_from_channel)
                .order_by(Order.created_at.desc())
                .limit(5)
            ).all()
            if recent_orders:
                order_lines = []
                for o in recent_orders:
                    shipped = f", shipped {o.shipped_at.date()}" if o.shipped_at else ""
                    eta = f", ETA {o.estimated_delivery_date.date()}" if o.estimated_delivery_date else ""
                    order_lines.append(
                        f"- Order #{o.id[:8]} ({o.status}) {o.currency} {float(o.total):.2f}{shipped}{eta}"
                    )
                system_prompt += "\n\nUser's recent orders:\n" + "\n".join(order_lines)
        except Exception as exc:
            logger.warning("_post_ai_reply: could not fetch orders for context: %s", exc)

        import anthropic
        ai_client = anthropic.Anthropic(api_key=anthropic_key)
        response = ai_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=512,
            system=system_prompt,
            messages=history_msgs,
        )
        reply_text = response.content[0].text if response.content else ""

        if reply_text:
            client.upsert_user({"id": "spree-support", "name": "Spree Support", "role": "user"})
            bot_channel = client.channel(channel_type, channel_id)
            bot_channel.send_message({"text": reply_text}, "spree-support")
            logger.info("_post_ai_reply: AI reply posted to channel=%s", channel_id)

            # CH5: in-app + email notification so the user knows they got a reply.
            try:
                user_obj = db.get(User, user_id_from_channel)
                notify_safe(
                    db,
                    event_type="chat_reply",
                    recipient_id=user_id_from_channel,
                    title="New message from Spree Support",
                    body=reply_text[:200],
                    notif_type="account",
                    href="/chat",
                    email_subject="You have a new message from Spree Support",
                    cta_label="View message",
                    cta_url=f"{settings.frontend_url}/chat",
                    recipient_email=user_obj.email if user_obj else None,
                )
            except Exception as exc:
                logger.warning("_post_ai_reply: notify_safe failed: %s", exc)

    except Exception as exc:
        logger.error("_post_ai_reply: failed for channel=%s: %s", channel_id, exc)


@webhook_router.post("/webhooks/stream")
async def stream_webhook(request: Request, db: DBSession):
    """
    Stream Chat webhook.  Called for every new message.
    Verified with HMAC-SHA256 (Stream signs with STREAM_WEBHOOK_SECRET).
    Claude AI reply is posted inline before returning so Vercel serverless
    does not kill the process between the response and a background task.
    """
    webhook_secret = getattr(settings, "stream_webhook_secret", "") or ""

    # C6: in deployed environments, reject all requests when the secret is not
    # configured — fail closed rather than accept unsigned events.
    if not webhook_secret and settings.is_deployed:
        logger.error(
            "stream_webhook: STREAM_WEBHOOK_SECRET is not set in production — "
            "rejecting request to prevent unsigned event processing"
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chat webhook not configured",
        )

    body = await request.body()

    # --- Signature verification -------------------------------------------
    if webhook_secret:
        sig_header = request.headers.get("x-signature", "")
        expected = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig_header):
            logger.warning("stream_webhook: invalid signature")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")

    try:
        payload = json.loads(body)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON")

    event_type = payload.get("type", "")
    if event_type != "message.new":
        return {"ok": True}

    message = payload.get("message", {})
    message_id: str = message.get("id", "")
    sender_id: str = (message.get("user") or {}).get("id", "")
    message_text: str = message.get("text", "")

    admin_id = _admin_user_id()
    channel_id: str = payload.get("channel_id", "")
    channel_type: str = payload.get("channel_type", "support")

    logger.info(
        "stream_webhook: message_new channel=%s sender=%s message_id=%s",
        channel_id,
        sender_id,
        message_id,
    )

    # Skip if the admin or AI bot sent this message.
    if sender_id in (admin_id, "spree-support"):
        return {"ok": True}

    # CH4: only process messages in support channels — ignore DMs, team channels, etc.
    if channel_type != "support" or not channel_id.startswith("support-"):
        return {"ok": True}

    # CH12: deduplicate retried webhooks by message_id (best-effort, in-process).
    if message_id and message_id in _processed_message_ids:
        logger.info("stream_webhook: duplicate message_id=%s, skipping", message_id)
        return {"ok": True}
    if message_id:
        _processed_message_ids.append(message_id)

    # CH5: notify the admin team that the user sent a message (every message, not just first).
    # CH11: first-message Stream query removed — dev_notifier now fires unconditionally.
    try:
        from app.services import dev_notifier
        dev_notifier.alert(
            "new_support_chat_message",
            f"User {sender_id} sent a support message",
            {
                "user_id": sender_id,
                "channel_id": channel_id,
                "message": message_text[:200],
            },
        )
    except Exception as exc:
        logger.warning("stream_webhook: dev_notifier failed: %s", exc)

    # CH7: DB-backed rate limit — prevents AI spam when a user sends many messages quickly.
    # Limits: 1 AI reply per channel per 20 s; 20 per channel per hour.
    try:
        _check_rate_limit(db, f"ai_chat:{channel_id}", max_calls=1, window_seconds=20)
        _check_rate_limit(db, f"ai_chat_hr:{channel_id}", max_calls=20, window_seconds=3600)
    except HTTPException:
        logger.info("stream_webhook: AI rate limit hit for channel=%s, skipping AI reply", channel_id)
        return {"ok": True}

    # CH3: AI reply inline — Vercel kills background tasks after the response is sent.
    _post_ai_reply(db, message_id, message_text, sender_id, channel_id, channel_type)

    return {"ok": True}

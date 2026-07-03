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
                           in the last 60 s, Claude posts an AI reply.
"""
from __future__ import annotations

import datetime
import hashlib
import hmac
import logging
import time
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.api.deps import ActorRole, ActorUserId, InternalAPIKey
from app.core.config import settings

logger = logging.getLogger(__name__)

# Internal routes (sit behind /api/v1 + X-Internal-Api-Key)
router = APIRouter()

# Public webhook route (no auth, mounted directly at /)
webhook_router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _stream_client():
    """Return a StreamChat server-side client, or raise 503 if not configured."""
    api_key = getattr(settings, "stream_api_key", "") or ""
    api_secret = getattr(settings, "stream_api_secret", "") or ""
    if not api_key or not api_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stream Chat is not configured (STREAM_API_KEY / STREAM_API_SECRET missing).",
        )
    from stream_chat import StreamChat  # type: ignore[import-untyped]
    return StreamChat(api_key=api_key, api_secret=api_secret)


def _admin_user_id() -> str:
    return getattr(settings, "stream_admin_user_id", "") or "spree-admin"


# ---------------------------------------------------------------------------
# GET /chat/token
# ---------------------------------------------------------------------------

@router.get("/chat/token")
def chat_token(
    _: InternalAPIKey,
    actor_id: ActorUserId,
    actor_role: ActorRole,
):
    """Issue a Stream Chat user token for the authenticated user."""
    if not actor_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    client = _stream_client()
    admin_id = _admin_user_id()
    channel_id = f"support-{actor_id}"

    # Upsert the Stream user so their display name is current.
    client.upsert_user({"id": actor_id, "role": "user", "name": actor_id})

    # Ensure the admin Stream user exists.
    client.upsert_user({"id": admin_id, "role": "admin", "name": "Spree Support"})

    # Create (or get) the support channel — members are strictly user + admin.
    channel = client.channel(
        "support",
        channel_id,
        data={"members": [actor_id, admin_id], "created_by_id": actor_id},
    )
    channel.create(actor_id)

    token = client.create_token(actor_id)
    return {
        "token": token,
        "userId": actor_id,
        "channelId": channel_id,
        "apiKey": getattr(settings, "stream_api_key", ""),
    }


# ---------------------------------------------------------------------------
# POST /chat/admin-token
# ---------------------------------------------------------------------------

@router.post("/chat/admin-token")
def chat_admin_token(_: InternalAPIKey, actor_role: ActorRole):
    """Issue a Stream Chat token for the admin user (used by the admin dashboard)."""
    if actor_role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    client = _stream_client()
    admin_id = _admin_user_id()

    # Ensure the admin Stream user exists.
    client.upsert_user({"id": admin_id, "role": "admin", "name": "Spree Support"})

    token = client.create_token(admin_id)
    return {
        "token": token,
        "userId": admin_id,
        "apiKey": getattr(settings, "stream_api_key", ""),
    }


# ---------------------------------------------------------------------------
# POST /webhooks/stream  (mounted on webhook_router — no internal key required)
# ---------------------------------------------------------------------------

@webhook_router.post("/webhooks/stream")
async def stream_webhook(request: Request):
    """
    Stream Chat webhook.  Called for every new message.
    Verified with HMAC-SHA256 (Stream signs with STREAM_WEBHOOK_SECRET).
    If the message is from a user (not the admin) and no admin replied
    recently, Claude posts an AI response as the 'spree-support' bot.
    """
    webhook_secret = getattr(settings, "stream_webhook_secret", "") or ""

    body = await request.body()

    # --- Signature verification -------------------------------------------
    if webhook_secret:
        sig_header = request.headers.get("x-signature", "")
        expected = hmac.new(webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig_header):
            logger.warning("stream_webhook: invalid signature")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")

    import json as _json
    try:
        payload = _json.loads(body)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON")

    event_type = payload.get("type", "")
    if event_type != "message.new":
        return {"ok": True}

    message = payload.get("message", {})
    sender_id: str = (message.get("user") or {}).get("id", "")
    message_text: str = message.get("text", "")

    admin_id = _admin_user_id()
    channel_id: str = payload.get("channel_id", "")
    channel_type: str = payload.get("channel_type", "support")

    logger.info(
        "stream_webhook: message_new channel=%s sender=%s",
        channel_id,
        sender_id,
    )

    # Skip if the admin sent this message.
    if sender_id == admin_id:
        return {"ok": True}

    # Skip if the AI bot itself sent it (avoid loops).
    if sender_id == "spree-support":
        return {"ok": True}

    # --- Check for recent admin reply ------------------------------------
    client = _stream_client()
    messages: list = []
    is_first_message = False

    try:
        channel = client.channel(channel_type, channel_id)
        state = channel.query({"messages": {"limit": 10}})
        messages = state.get("messages", [])

        now_ts = time.time()
        for msg in reversed(messages[:-1]):  # exclude the just-sent message
            msg_sender_id = (msg.get("user") or {}).get("id", "")
            if msg_sender_id == admin_id:
                created_at_str = msg.get("created_at", "")
                if created_at_str:
                    try:
                        dt = datetime.datetime.fromisoformat(created_at_str.rstrip("Z"))
                        age_seconds = now_ts - dt.replace(tzinfo=datetime.timezone.utc).timestamp()
                        if age_seconds < 60:
                            logger.info("stream_webhook: admin replied recently, skipping AI")
                            return {"ok": True}
                    except Exception:
                        pass
                break

        # First message check for dev notification
        is_first_message = len(messages) <= 1
    except Exception as exc:
        logger.warning("stream_webhook: failed to query channel history: %s", exc)

    # --- Dev notification on first user message --------------------------
    if is_first_message:
        try:
            from app.services import dev_notifier
            dev_notifier.alert(
                "new_support_chat",
                f"New support channel opened by user {sender_id}",
                {
                    "user_id": sender_id,
                    "channel_id": channel_id,
                    "first_message": message_text[:200],
                },
            )
        except Exception as exc:
            logger.warning("stream_webhook: dev_notifier failed: %s", exc)

    # --- Claude AI reply -------------------------------------------------
    anthropic_key = getattr(settings, "anthropic_api_key", "") or ""
    if not anthropic_key:
        logger.info("stream_webhook: ANTHROPIC_API_KEY not set, skipping AI reply")
        return {"ok": True}

    try:
        # Build conversation history for context (last 8 messages).
        history_msgs: list[dict] = []
        for msg in messages[-8:]:
            msg_sender_id = (msg.get("user") or {}).get("id", "")
            role = "assistant" if msg_sender_id in (admin_id, "spree-support") else "user"
            text = msg.get("text", "")
            if text:
                history_msgs.append({"role": role, "content": text})

        # If the current message isn't already at the end of history, add it.
        if not history_msgs or history_msgs[-1].get("content") != message_text:
            history_msgs.append({"role": "user", "content": message_text})

        # Ensure history starts with a user message (Claude requirement).
        if history_msgs and history_msgs[0]["role"] == "assistant":
            history_msgs = history_msgs[1:]
        if not history_msgs:
            history_msgs = [{"role": "user", "content": message_text}]

        user_id_from_channel = channel_id.replace("support-", "", 1) if channel_id.startswith("support-") else sender_id

        system_prompt = (
            "You are Spree Support, the helpful assistant for Spree — a Ghanaian online marketplace. "
            "You help buyers and sellers with orders, payments, delivery, and account issues. "
            "Be friendly, concise, and professional. Write in plain English (not Markdown). "
            "If you don't know something specific (like a particular order status), ask the user "
            "for their Order ID and tell them a human agent will follow up. "
            f"Current user ID: {user_id_from_channel}."
        )

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
            # Post reply as the spree-support bot user.
            client.upsert_user({"id": "spree-support", "name": "Spree Support", "role": "user"})
            bot_channel = client.channel(channel_type, channel_id)
            bot_channel.send_message({"text": reply_text}, "spree-support")
            logger.info("stream_webhook: AI reply posted to channel=%s", channel_id)

    except Exception as exc:
        logger.error("stream_webhook: Claude API call failed: %s", exc)

    return {"ok": True}

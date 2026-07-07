"""
One-off (idempotent) Stream Chat setup script.

Run this once against the production Stream app before the first deploy,
or any time you need to recreate the channel type:

    cd backend
    python scripts/setup_stream.py

What it does:
  - Creates (or updates) the "support" channel type so buyers can open
    support channels and the widget connects successfully.
  - Upserts the shared admin Stream user.

It is safe to run multiple times — it checks whether the type already
exists and only creates it if missing, or updates config if present.
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

# Allow running directly from the repo root or from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

CHANNEL_TYPE = "support"

# Minimal config — Stream fills defaults for everything not specified.
# Keep grants simple: members can read and send; admin can do anything.
CHANNEL_TYPE_CONFIG: dict = {
    "name": CHANNEL_TYPE,
    "typing_events": True,
    "read_events": True,
    "connect_events": True,
    "reactions": True,
    "replies": False,       # support conversations are linear, no threading
    "mutes": False,
    "message_retention": "infinite",
    "max_message_length": 5000,
    "automod": "disabled",
}


def _make_client():
    api_key = getattr(settings, "stream_api_key", "") or ""
    api_secret = getattr(settings, "stream_api_secret", "") or ""
    if not api_key or not api_secret:
        logger.error(
            "STREAM_API_KEY and STREAM_API_SECRET must be set in the environment.\n"
            "Copy backend/.env.example → backend/.env and fill in your Stream credentials."
        )
        sys.exit(1)
    from stream_chat import StreamChat  # type: ignore[import-untyped]
    return StreamChat(api_key=api_key, api_secret=api_secret)


def run() -> None:
    client = _make_client()
    from stream_chat.base.exceptions import StreamAPIException  # type: ignore[import-untyped]

    # Check whether the channel type already exists.
    exists = False
    try:
        resp = client.get_channel_type(CHANNEL_TYPE)
        if resp.get("name"):
            exists = True
            logger.info("Channel type '%s' already exists.", CHANNEL_TYPE)
    except StreamAPIException as exc:
        # Stream returns 400/code≈16 when the type isn't found.
        logger.info(
            "Channel type '%s' not found (code=%s) — will create it.",
            CHANNEL_TYPE, exc.error_code,
        )
    except Exception as exc:
        logger.error("Unexpected error checking channel type: %s", exc)
        sys.exit(1)

    if exists:
        # Re-apply config to pick up any changes (name key excluded — it's the path param).
        update_data = {k: v for k, v in CHANNEL_TYPE_CONFIG.items() if k != "name"}
        try:
            client.update_channel_type(CHANNEL_TYPE, **update_data)
            logger.info("Channel type '%s' config updated.", CHANNEL_TYPE)
        except StreamAPIException as exc:
            logger.warning(
                "Could not update channel type config: code=%s %s",
                exc.error_code, exc.error_message,
            )
    else:
        try:
            client.create_channel_type(CHANNEL_TYPE_CONFIG)
            logger.info("Channel type '%s' created.", CHANNEL_TYPE)
        except StreamAPIException as exc:
            logger.error(
                "Failed to create channel type '%s': code=%s %s",
                CHANNEL_TYPE, exc.error_code, exc.error_message,
            )
            sys.exit(1)

    # Upsert the shared admin Stream user.
    admin_id = getattr(settings, "stream_admin_user_id", "") or "spree-admin"
    try:
        client.upsert_user({"id": admin_id, "role": "admin", "name": "Spree Support"})
        logger.info("Admin Stream user '%s' upserted.", admin_id)
    except StreamAPIException as exc:
        logger.warning(
            "Could not upsert admin user '%s': code=%s %s",
            admin_id, exc.error_code, exc.error_message,
        )

    logger.info(
        "\nSetup complete. Deploy the backend and the chat widget should connect.\n"
        "If users still see errors, check STREAM_API_KEY / STREAM_API_SECRET / "
        "STREAM_WEBHOOK_SECRET in your deployed environment variables."
    )


if __name__ == "__main__":
    run()

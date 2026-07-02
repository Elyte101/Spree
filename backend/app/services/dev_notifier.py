"""
Developer alert service — sends structured logs and optional email to the dev team.

Usage:
    from app.services import dev_notifier
    dev_notifier.alert("payment_failure", "Charge failed", {"reference": ref, "order_id": oid})

A failed dev-alert must never crash the caller.  All exceptions are silently swallowed
after logging.

To enable email alerts, set DEV_ALERT_EMAIL in the backend .env file.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("spree.dev")


def alert(event: str, summary: str, details: dict[str, Any] | None = None) -> None:
    """
    Fire a developer alert.

    1. Logs at ERROR level with structured context.
    2. Sends an email to DEV_ALERT_EMAIL (if configured).

    Never raises.
    """
    try:
        context = {"event": event, **(details or {})}
        logger.error("DEV ALERT [%s] %s | %s", event, summary, context)
        _send_dev_email(event, summary, details or {})
    except Exception as exc:  # noqa: BLE001
        logger.warning("dev_notifier.alert failed silently: %s", exc)


def _send_dev_email(event: str, summary: str, details: dict[str, Any]) -> None:
    from app.core.config import settings

    dev_email = getattr(settings, "dev_alert_email", "") or ""
    if not dev_email:
        return

    if not settings.resend_api_key:
        logger.debug("Resend not configured; skipping dev alert email for event=%s", event)
        return

    rows = "".join(
        f"<tr><td style='padding:4px 12px 4px 0;color:#6b7280;vertical-align:top'>{k}</td>"
        f"<td style='padding:4px 0;color:#111827'>{v}</td></tr>"
        for k, v in details.items()
    )
    html = f"""
    <div style="font-family:monospace;max-width:600px;margin:0 auto;padding:24px 16px">
      <h2 style="margin:0 0 4px;color:#dc2626">[Spree] Dev Alert: {event}</h2>
      <p style="margin:0 0 16px;color:#374151">{summary}</p>
      <table style="border-collapse:collapse;width:100%">{rows}</table>
    </div>"""

    try:
        import resend
        resend.api_key = settings.resend_api_key
        resend.Emails.send({
            "from": settings.email_from,
            "to": [dev_email],
            "subject": f"[Spree Dev Alert] {event}: {summary}",
            "html": html,
        })
    except Exception as exc:
        logger.warning("Failed to send dev alert email for event=%s: %s", event, exc)

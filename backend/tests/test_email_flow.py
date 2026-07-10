"""2026-07-10 email flow assessment — tests for STEP 0 (unified sender domain +
structured logging) and STEP 2 (bounded Resend timeout). STEP 1 (signup
triggers verification) is tested in test_api.py (backend pipeline) and
app/api/auth/signup/signup-verification-email.test.ts (frontend trigger).
STEP 3's finding (no duplicate-send bug) is tested in test_api.py.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from unittest.mock import patch

_env_path = Path(__file__).resolve().parents[1] / ".env"
if _env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_path, override=False)

from app.core.config import settings
from app.services import notifications as notif_svc


def _with_resend_configured():
    """Context-manager-free helper: temporarily force resend_api_key truthy
    so _send_email doesn't take its "not configured" early return."""
    return patch.object(settings, "resend_api_key", "re_test_dummy_key")


def test_send_email_skips_gracefully_without_api_key(caplog):
    with patch.object(settings, "resend_api_key", ""):
        with caplog.at_level(logging.WARNING, logger="app.services.notifications"):
            notif_svc._send_email("nobody@test.com", "Subject", "<p>body</p>")

    assert any(
        getattr(r, "email_status", None) == "skipped_no_api_key" for r in caplog.records
    )


def test_send_email_logs_structured_success(caplog):
    with _with_resend_configured():
        with patch("resend.Emails.send", return_value={"id": "email-abc123"}):
            with caplog.at_level(logging.INFO, logger="app.services.notifications"):
                notif_svc._send_email("someone@test.com", "Subject", "<p>body</p>")

    matching = [r for r in caplog.records if getattr(r, "email_status", None) == "sent"]
    assert matching, "Expected a log record with email_status='sent'"
    assert matching[0].resend_message == "email-abc123"
    # The reserved LogRecord key `message` must never be used as an extra= key.
    assert not any(getattr(r, "__dict__", {}).get("message") == "email-abc123" for r in caplog.records)


def test_send_email_logs_structured_failure_and_does_not_raise(caplog):
    with _with_resend_configured():
        with patch("resend.Emails.send", side_effect=RuntimeError("Resend API unreachable")):
            with caplog.at_level(logging.WARNING, logger="app.services.notifications"):
                # Must not raise — email sends are always non-fatal.
                notif_svc._send_email("someone@test.com", "Subject", "<p>body</p>")

    matching = [r for r in caplog.records if getattr(r, "email_status", None) == "failed"]
    assert matching, "Expected a log record with email_status='failed'"
    assert "Resend API unreachable" in matching[0].error


def test_send_email_configures_bounded_resend_timeout():
    """STEP 2: Resend's Python SDK defaults to a 30s HTTP timeout — longer
    than the Next proxy's 15s AbortSignal.timeout. _send_email must bound it
    well under 15s so a slow Resend call can't itself cause a proxy timeout."""
    notif_svc._resend_client_configured = False
    with _with_resend_configured():
        with patch("resend.Emails.send", return_value={"id": "x"}):
            notif_svc._send_email("someone@test.com", "Subject", "<p>body</p>")

    import resend
    assert resend.default_http_client._timeout <= 10
    assert resend.default_http_client._timeout == notif_svc._RESEND_TIMEOUT_SECONDS


def test_password_reset_request_uses_bounded_resend_timeout(monkeypatch):
    """End-to-end through the real call chain (request_password_reset →
    notify_safe → _send_email → resend.Emails.send → RequestsClient.request →
    requests.request) — confirms the bounded timeout is actually threaded
    down to the underlying HTTP call, not just configured and ignored."""
    from fastapi.testclient import TestClient
    from app.main import app

    notif_svc._resend_client_configured = False
    captured_kwargs: dict = {}

    def fake_requests_request(*args, **kwargs):
        captured_kwargs.update(kwargs)
        import requests
        resp = requests.Response()
        resp.status_code = 200
        resp._content = b'{"id": "email-xyz"}'
        return resp

    internal_key = os.environ.get("BACKEND_INTERNAL_API_KEY", "spree-internal-dev-key")

    with _with_resend_configured():
        with patch("requests.request", side_effect=fake_requests_request):
            with TestClient(app) as client:
                signup = client.post(
                    "/api/v1/auth/signup",
                    headers={"X-Internal-Api-Key": internal_key},
                    json={"name": "Reset Timeout", "email": "reset-timeout@test.com", "password": "ResetPass123!"},
                )
                assert signup.status_code == 201

                resp = client.post(
                    "/api/v1/auth/password-reset/request",
                    headers={"X-Internal-Api-Key": internal_key},
                    json={"email": "reset-timeout@test.com"},
                )

    assert resp.status_code == 200
    assert captured_kwargs.get("timeout") == notif_svc._RESEND_TIMEOUT_SECONDS

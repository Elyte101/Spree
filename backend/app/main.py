import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import Response

from app.api.router import api_router
from app.api.routes.chat import webhook_router
from app.core.config import settings
from app.core.logging import configure_logging, request_logging_middleware, security_headers_middleware
from app.db.init_db import initialize_database
from app.db.session import engine

configure_logging()
_startup_log = logging.getLogger("app.startup")


def _check_payment_config() -> None:
    if not settings.payments_mock and not settings.paystack_secret_key:
        _startup_log.critical(
            "PAYMENT CONFIG ERROR: PAYMENTS_MOCK=false but PAYSTACK_SECRET_KEY is not set. "
            "All payment endpoints will fail at runtime. "
            "Set PAYSTACK_SECRET_KEY in your environment, or set PAYMENTS_MOCK=true for local dev."
        )


def _check_stream_config() -> None:
    if settings.is_deployed and not settings.stream_webhook_secret:
        _startup_log.critical(
            "STREAM CONFIG ERROR: STREAM_WEBHOOK_SECRET is not set in a deployed environment. "
            "The /webhooks/stream endpoint will reject all requests (fail closed). "
            "Set STREAM_WEBHOOK_SECRET to the signing secret from your Stream dashboard."
        )


def _ensure_stream_channel_type() -> None:
    """Idempotently create the 'support' Stream channel type if it doesn't exist.

    Called at startup so the first deploy auto-provisions the channel type
    without needing a manual script run. Logs a critical warning (not a crash)
    if creation fails, so the rest of the app still starts.
    """
    api_key = getattr(settings, "stream_api_key", "") or ""
    api_secret = getattr(settings, "stream_api_secret", "") or ""
    if not api_key or not api_secret:
        return  # Stream not configured — skip silently in dev

    try:
        from stream_chat import StreamChat  # type: ignore[import-untyped]
        from stream_chat.base.exceptions import StreamAPIException  # type: ignore[import-untyped]

        client = StreamChat(api_key=api_key, api_secret=api_secret)

        try:
            resp = client.get_channel_type("support")
            if resp.get("name"):
                return  # already exists
        except StreamAPIException:
            pass  # not found or other error — fall through to create

        client.create_channel_type({
            "name": "support",
            "typing_events": True,
            "read_events": True,
            "connect_events": True,
            "reactions": True,
            "replies": False,
            "mutes": False,
            "message_retention": "infinite",
            "max_message_length": 5000,
            "automod": "disabled",
        })
        _startup_log.info("STREAM SETUP: created 'support' channel type.")

    except Exception as exc:
        _startup_log.critical(
            "STREAM SETUP: could not ensure 'support' channel type exists: %s — "
            "run backend/scripts/setup_stream.py manually, then redeploy.",
            exc,
        )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database()
    _check_payment_config()
    _check_stream_config()
    _ensure_stream_channel_type()
    yield


app = FastAPI(
    title=settings.app_name,
    docs_url="/docs" if settings.api_docs_enabled else None,
    redoc_url="/redoc" if settings.api_docs_enabled else None,
    openapi_url="/openapi.json" if settings.api_docs_enabled else None,
    lifespan=lifespan,
)

if settings.trusted_hosts != ["*"]:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(o) for o in settings.cors_origins],
    allow_credentials="*" not in settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.middleware("http")(security_headers_middleware)
app.middleware("http")(request_logging_middleware)


_FAVICON = Path(__file__).parent / "static" / "favicon.ico"


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(content=_FAVICON.read_bytes(), media_type="image/x-icon")


@app.get("/healthz")
def healthcheck():
    return {"status": "ok", "environment": settings.environment}


@app.get("/readyz")
def readiness_check():
    if engine is None:
        return {"status": "unavailable", "reason": "DATABASE_URL not configured"}
    return {"status": "ready"}


app.include_router(api_router, prefix=settings.api_v1_prefix)
# Webhook route: mounted outside /api/v1 so Stream can POST to /webhooks/stream
# without needing the internal API key header.
app.include_router(webhook_router, tags=["webhooks"])

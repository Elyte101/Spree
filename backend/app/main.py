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


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database()
    _check_payment_config()
    _check_stream_config()
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

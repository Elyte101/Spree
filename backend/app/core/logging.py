import logging
import time
import uuid

from fastapi import Request

from app.core.config import settings

logger = logging.getLogger("spree.api")

# Attributes that Python's logging module sets on every LogRecord.
# Passing any of these as extra= keys raises:
#   KeyError: "Attempt to overwrite '<key>' in LogRecord"
# Keep this in sync with cpython/Lib/logging/__init__.py LogRecord.__init__.
_LOG_RECORD_RESERVED: frozenset[str] = frozenset({
    "args", "asctime", "created", "exc_info", "exc_text", "filename",
    "funcName", "id", "levelname", "levelno", "lineno", "message",
    "module", "msecs", "msg", "name", "pathname", "process",
    "processName", "relativeCreated", "stack_info", "taskName",
    "thread", "threadName",
})


def safe_extra(fields: dict) -> dict:
    """Return *fields* with reserved LogRecord key names prefixed by 'ps_'.

    Prevents ``KeyError: "Attempt to overwrite '<key>' in LogRecord"``
    when structured-logging data from Paystack or other external sources
    contains a key that collides with a built-in LogRecord attribute.
    """
    return {
        (f"ps_{k}" if k in _LOG_RECORD_RESERVED else k): v
        for k, v in fields.items()
    }

_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: https:; "
    "font-src 'self' https:; "
    "connect-src 'self' https:; "
    "frame-ancestors 'none';"
)


def configure_logging() -> None:
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        force=True,
    )


async def request_logging_middleware(request: Request, call_next):
    request_id = uuid.uuid4().hex[:12]
    started_at = time.perf_counter()

    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - started_at) * 1000
        logger.exception(
            "%s %s failed in %.2fms request_id=%s",
            request.method,
            request.url.path,
            elapsed_ms,
            request_id,
        )
        raise

    elapsed_ms = (time.perf_counter() - started_at) * 1000
    logger.info(
        "%s %s -> %s in %.2fms request_id=%s",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
        request_id,
    )
    response.headers["X-Request-ID"] = request_id
    return response


async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Content-Security-Policy", _CSP)
    response.headers.setdefault(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=()",
    )

    if settings.is_deployed:
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )

    return response

import logging
import time
import uuid

from fastapi import Request

from app.core.config import settings

logger = logging.getLogger("spree.api")


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

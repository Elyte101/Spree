from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import Response

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, request_logging_middleware, security_headers_middleware
from app.db.init_db import initialize_database
from app.db.session import engine

configure_logging()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    initialize_database()
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


@app.get("/healthz")
def healthcheck():
    return {"status": "ok", "environment": settings.environment}


@app.get("/readyz")
def readiness_check():
    if engine is None:
        return {"status": "unavailable", "reason": "DATABASE_URL not configured"}
    return {"status": "ready"}


@app.get("/uploads/{path:path}")
def serve_upload(path: str):
    """Serve uploaded identity documents. On Vercel these live in /tmp and are
    ephemeral — replace with cloud storage (S3/Cloudinary) for production."""
    from app.services.uploads import _uploads_root

    uploads_root = _uploads_root()
    file_path = (uploads_root / path).resolve()

    # Path traversal guard
    try:
        file_path.relative_to(uploads_root.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Forbidden")

    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    suffix = Path(path).suffix.lower()
    media_types = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    media_type = media_types.get(suffix, "application/octet-stream")

    return Response(content=file_path.read_bytes(), media_type=media_type)


app.include_router(api_router, prefix=settings.api_v1_prefix)

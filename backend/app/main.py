from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, request_logging_middleware, security_headers_middleware
from app.db.init_db import initialize_database
from app.db.session import engine
from app.services.uploads import _uploads_root

configure_logging()
cors_origins = [str(origin) for origin in settings.cors_origins]


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
    allow_origins=cors_origins,
    allow_credentials="*" not in cors_origins,
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
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {"status": "ready"}


app.include_router(api_router, prefix=settings.api_v1_prefix)

# Serve uploaded ID documents and seller photos
uploads_path = _uploads_root()
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

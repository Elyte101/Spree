import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Spree Backend"
    environment: Literal["development", "test", "production"] = "development"
    api_v1_prefix: str = "/api/v1"

    # None = not yet configured; DB-dependent routes return HTTP 503 gracefully
    database_url: str | None = Field(default=None)

    enable_api_docs: bool | None = None
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    trusted_hosts: list[str] = ["*"]

    default_shipping_rate: float = 12.0
    express_shipping_rate: float = 18.0
    free_shipping_threshold: float = 200.0

    seed_admin_name: str = "Spree Admin"
    seed_admin_email: str = "admin@spree.local"
    seed_admin_password: str = "ChangeMe123!"

    # Must match the BACKEND_INTERNAL_API_KEY used by the Next.js frontend.
    # Default matches the Next.js runtimeConfig.ts dev fallback so local dev
    # works without setting the env var on either side.
    backend_internal_api_key: str = "spree-internal-dev-key"

    auto_initialize_database: bool = True
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    paystack_secret_key: str = ""
    paystack_public_key: str = ""

    # Override the uploads storage directory (defaults to /tmp/uploads on Vercel)
    uploads_dir: str = ""

    @field_validator("backend_internal_api_key", mode="after")
    @classmethod
    def warn_default_api_key(cls, value: str) -> str:
        if value == "2de75f671a37aaddae2b209a9a8d3844ae1c58a0":
            import warnings
            warnings.warn(
                "BACKEND_INTERNAL_API_KEY is using the hardcoded default. "
                "Set a strong random value in your environment before going to production.",
                stacklevel=2,
            )
        return value

    @field_validator("seed_admin_password", mode="after")
    @classmethod
    def warn_default_seed_password(cls, value: str) -> str:
        if value in ("ChangeMe123!", "password", "admin"):
            import warnings
            warnings.warn(
                "SEED_ADMIN_PASSWORD is using a weak default. "
                "Set a strong password in your environment.",
                stacklevel=2,
            )
        return value

    @field_validator("cors_origins", "trusted_hosts", mode="before")
    @classmethod
    def parse_list_setting(cls, value: list[str] | str) -> list[str]:
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return []
            if stripped.startswith("["):
                return json.loads(stripped)
            return [v.strip() for v in stripped.split(",") if v.strip()]
        return value

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str | None) -> str | None:
        if not value:
            return None

        # SQLite is accepted for local development and testing; skip all Postgres normalisation.
        if value.startswith("sqlite://"):
            return value

        # Reject non-postgres URLs for everything else.
        if not (value.startswith("postgres://") or value.startswith("postgresql")):
            raise ValueError(
                f"DATABASE_URL must start with postgres:// or postgresql://. "
                f"Got scheme: '{value.split('://')[0]}://...'. "
                "Use the non-pooling PostgreSQL connection string from your Supabase project, "
                "NOT the Supabase HTTPS URL or a Prisma/pgBouncer URL."
            )

        # Normalise to the psycopg3 dialect SQLAlchemy requires.
        if value.startswith("postgres://"):
            value = value.replace("postgres://", "postgresql+psycopg://", 1)
        elif value.startswith("postgresql://") and "+psycopg" not in value:
            value = value.replace("postgresql://", "postgresql+psycopg://", 1)

        # Strip params that are Supabase/Prisma-specific and unknown to SQLAlchemy.
        # pgbouncer=true  — PgBouncer flag; breaks prepared statements in SQLAlchemy
        # supa=*          — Supabase internal routing param
        from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
        parsed = urlparse(value)
        params = parse_qs(parsed.query, keep_blank_values=True)
        params.pop("pgbouncer", None)
        params.pop("supa", None)
        clean_query = urlencode({k: v[0] for k, v in params.items()})
        value = urlunparse(parsed._replace(query=clean_query))

        return value

    @computed_field
    @property
    def is_deployed(self) -> bool:
        return os.getenv("VERCEL") == "1" or self.environment == "production"

    @computed_field
    @property
    def api_docs_enabled(self) -> bool:
        if self.enable_api_docs is not None:
            return self.enable_api_docs
        return not self.is_deployed

    @computed_field
    @property
    def should_seed_admin(self) -> bool:
        if not self.is_deployed:
            return True
        return all(
            os.getenv(name)
            for name in ("SEED_ADMIN_NAME", "SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD")
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
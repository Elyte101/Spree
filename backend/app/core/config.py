import json
import os
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
LOCAL_DB_PATH = BACKEND_DIR / "data" / "spree_store.db"
VERCEL_DB_PATH = Path(tempfile.gettempdir()) / "spree_store.db"


def default_database_url() -> str | None:
    # In deployed environments, require an explicit DATABASE_URL rather than
    # silently using an ephemeral SQLite file that loses data on every cold start.
    if os.getenv("VERCEL") == "1" or os.getenv("APP_ENV") == "production":
        return None

    return f"sqlite:///{LOCAL_DB_PATH.as_posix()}"


class Settings(BaseSettings):
    app_name: str = "Spree Backend"
    environment: Literal["development", "test", "production"] = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str | None = Field(default_factory=default_database_url)
    enable_api_docs: bool | None = None
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    trusted_hosts: list[str] = ["*"]
    default_shipping_rate: float = 12.0
    free_shipping_threshold: float = 200.0
    seed_admin_name: str = "Spree Admin"
    seed_admin_email: str = "admin@spree.local"
    seed_admin_password: str = "ChangeMe123!"
    internal_api_key: str = "spree-internal-dev-key"
    auto_initialize_database: bool = True
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    paystack_secret_key: str = ""
    paystack_public_key: str = ""
    uploads_dir: str = ""  # defaults to backend/uploads at runtime

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("cors_origins", "trusted_hosts", mode="before")
    @classmethod
    def parse_list_setting(cls, value: list[str] | str):
        if isinstance(value, str):
            stripped_value = value.strip()

            if not stripped_value:
                return []

            if stripped_value.startswith("["):
                return json.loads(stripped_value)

            return [origin.strip() for origin in stripped_value.split(",") if origin.strip()]

        return value

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str | None) -> str | None:
        if not value:
            return value

        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)

        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)

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

        required_seed_envs = ("SEED_ADMIN_NAME", "SEED_ADMIN_EMAIL", "SEED_ADMIN_PASSWORD")
        return all(os.getenv(name) for name in required_seed_envs)

    @model_validator(mode="after")
    def validate_deployed_settings(self) -> "Settings":
        # DATABASE_URL is validated lazily in session.py so a missing DB does not
        # crash the entire process — routes that need the DB return HTTP 503 instead.

        if self.is_deployed and self.internal_api_key == "spree-internal-dev-key":
            raise ValueError("INTERNAL_API_KEY must be set for deployed environments.")

        if self.is_deployed and len(self.internal_api_key) < 24:
            raise ValueError("INTERNAL_API_KEY must be at least 24 characters in deployed environments.")

        if self.is_deployed and self.should_seed_admin:
            if self.seed_admin_password == "ChangeMe123!" or len(self.seed_admin_password) < 12:
                raise ValueError(
                    "SEED_ADMIN_PASSWORD must be changed and at least 12 characters in deployed environments."
                )

        return self

    @computed_field
    @property
    def sqlite_path(self) -> Path | None:
        prefix = "sqlite:///"
        if not self.database_url or not self.database_url.startswith(prefix):
            return None

        return Path(self.database_url.removeprefix(prefix))


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

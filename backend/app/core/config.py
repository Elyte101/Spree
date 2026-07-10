import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]

# A1/A2: fail closed on weak/default secrets in deployed environments — a
# secret that's merely present but equal to the checked-in dev default (or
# implausibly short) is exactly as forgeable as leaving it unset.
_MIN_SECRET_LENGTH = 20
_DEFAULT_SECRETS = {
    "backend_internal_api_key": "spree-internal-dev-key",
    "actor_token_secret": "spree-dev-actor-token-secret-change-me",
}


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

    # A2: shared secret used to verify short-lived HS256 actor tokens minted by
    # the Next proxy (lib/actorToken.ts). Must match ACTOR_TOKEN_SECRET on the
    # frontend. Distinct from backend_internal_api_key so the two can rotate
    # independently.
    actor_token_secret: str = "spree-dev-actor-token-secret-change-me"

    auto_initialize_database: bool = True
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    paystack_secret_key: str = ""
    paystack_public_key: str = ""

    # Set PAYMENTS_MOCK=true only in local dev or CI to bypass real Paystack calls.
    # Defaults to false — NEVER set true in production.
    payments_mock: bool = False

    @field_validator("payments_mock", mode="after")
    @classmethod
    def reject_mock_in_production(cls, value: bool) -> bool:
        if value and os.getenv("VERCEL") == "1":
            import warnings
            warnings.warn(
                "PAYMENTS_MOCK=true is set but VERCEL=1 is detected — "
                "this disables real Paystack calls in a deployed environment. "
                "Unset PAYMENTS_MOCK before going live.",
                stacklevel=2,
            )
        return value

    # Override the uploads storage directory (defaults to /tmp/uploads on Vercel)
    uploads_dir: str = ""

    # Stream Chat
    stream_api_key: str = ""
    stream_api_secret: str = ""
    stream_admin_user_id: str = "spree-admin"
    stream_webhook_secret: str = ""

    # Anthropic / Claude AI (for support chat auto-replies)
    anthropic_api_key: str = ""

    # Resend email API
    resend_api_key: str = ""
    # 2026-07-10 email flow assessment: the frontend (lib/email.ts) and backend
    # used two different sender domains (spree.com / spree.market), neither of
    # which is a verified Resend domain — one silently failed on every send.
    # Both now default to Resend's sandbox sender (works without domain
    # verification, but only delivers to the Resend account's own email).
    # Swap this to a real address once a custom domain is verified in Resend —
    # EMAIL_FROM must be set to the SAME value on both frontend and backend.
    email_from: str = "Spree <onboarding@resend.dev>"
    frontend_url: str = "http://localhost:3000"

    # Developer alert email (sent by dev_notifier on critical events)
    # Requires resend_api_key to be configured.
    dev_alert_email: str = ""

    # Web Push VAPID keys (generate once with: pywebpush --gen-vapid-keys)
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_subject: str = "mailto:admin@spree.com"

    # Smile ID — identity verification (Ghana Card lookup + SmartSelfie liveness)
    # Base URL: https://api.smileidentity.com/v1  (sandbox uses the same host)
    smileid_partner_id: str = ""
    smileid_api_key: str = ""
    smileid_environment: Literal["sandbox", "production"] = "sandbox"
    # Thresholds: 0.0–1.0 (Smile ID returns 0–100, we normalise on receipt)
    smileid_liveness_threshold: float = 0.85
    smileid_match_threshold: float = 0.85
    # Max face-verify attempts before the step is locked (seller must contact support)
    smileid_max_attempts: int = 3

    @field_validator("backend_internal_api_key", "actor_token_secret", mode="after")
    @classmethod
    def require_strong_secret_when_deployed(cls, value: str, info) -> str:
        is_deployed = os.getenv("VERCEL") == "1" or info.data.get("environment") == "production"
        default_value = _DEFAULT_SECRETS.get(info.field_name, "")

        if is_deployed and (value == default_value or len(value) < _MIN_SECRET_LENGTH):
            raise ValueError(
                f"{info.field_name.upper()} must be set to a strong random value "
                f"(>= {_MIN_SECRET_LENGTH} chars, not the dev default) in deployed environments. "
                "Refusing to start with a default or weak secret."
            )

        if not is_deployed and value == default_value:
            import warnings
            warnings.warn(
                f"{info.field_name.upper()} is using the hardcoded dev default. "
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
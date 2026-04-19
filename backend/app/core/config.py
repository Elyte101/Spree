from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AnyHttpUrl, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = BACKEND_DIR / "data" / "spree_store.db"


class Settings(BaseSettings):
    app_name: str = "Spree Backend"
    environment: Literal["development", "test", "production"] = "development"
    api_v1_prefix: str = "/api/v1"
    database_url: str = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"
    cors_origins: list[AnyHttpUrl | str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    default_shipping_rate: float = 12.0
    free_shipping_threshold: float = 200.0
    seed_admin_name: str = "Spree Admin"
    seed_admin_email: str = "admin@spree.local"
    seed_admin_password: str = "ChangeMe123!"
    internal_api_key: str = "spree-internal-dev-key"
    auto_initialize_database: bool = True
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @computed_field
    @property
    def sqlite_path(self) -> Path | None:
        prefix = "sqlite:///"
        if not self.database_url.startswith(prefix):
            return None

        return Path(self.database_url.removeprefix(prefix))


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

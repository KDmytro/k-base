"""Application configuration."""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )

    # Database
    database_url: str = "postgresql+asyncpg://localhost:5432/kbase"

    # LLM Providers
    openai_api_key: str
    anthropic_api_key: Optional[str] = None

    # Application
    app_env: str = "development"
    debug: bool = True
    log_level: str = "INFO"

    # Limits
    max_context_tokens: int = 8000
    max_memory_results: int = 10

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.app_env == "development"


# Global settings instance
settings = Settings()

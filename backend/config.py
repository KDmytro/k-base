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
    google_api_key: Optional[str] = None  # GOOGLE_API_KEY for Gemini models
    default_model: str = "gpt-4o-mini"

    # Application
    app_env: str = "development"
    debug: bool = True
    log_level: str = "INFO"

    # Auth - Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    jwt_secret_key: str = "dev-secret-change-in-production"  # Change in production!
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24 * 7  # 1 week

    # Limits
    max_context_tokens: int = 8000
    max_memory_results: int = 10

    # CORS - can be overridden with CORS_ORIGINS env var (comma-separated)
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://k-base-app.web.app",
        "https://k-base-app.firebaseapp.com",
    ]

    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.app_env == "development"


# Global settings instance
settings = Settings()

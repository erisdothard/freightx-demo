"""
FreightX API — Configuration via Pydantic Settings

INTERVIEW NOTE: This is one of the most-asked FastAPI topics.
"How do you manage configuration in FastAPI?"

Answer: pydantic-settings loads env vars automatically. Each field maps to an
environment variable. Type hints provide validation — if SUPABASE_URL is missing
or API_PORT isn't an int, the app won't even start. This is "fail fast" design.

Key concepts:
- BaseSettings reads from .env files AND actual environment variables
- Environment variables OVERRIDE .env file values (12-factor app principle)
- model_config replaces the old inner `class Config` (Pydantic v2 change)
- Settings are instantiated once and injected via Depends() — never imported globally

Why not just os.getenv()?
- No validation, no type casting, no defaults, no documentation
- pydantic-settings gives you all four + IDE autocomplete
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    INTERVIEW NOTE: Every field here becomes a required (or defaulted) env var.
    FastAPI auto-generates docs from these field names + types.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,  # SUPABASE_URL == supabase_url
    )

    # --- Supabase ---
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str = ""

    # --- Stripe ---
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    # --- App ---
    app_url: str = "http://localhost:5173"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    environment: str = "development"  # development | staging | production

    # --- CORS ---
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origins(self) -> list[str]:
        """
        INTERVIEW NOTE: CORS origins must be a list, but env vars are strings.
        This property splits the comma-separated string into a list.
        Interviewers love asking "how do you handle CORS in FastAPI?"
        """
        return [origin.strip() for origin in self.allowed_origins.split(",")]


# Singleton — instantiated once, reused everywhere via dependency injection
settings = Settings()

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "Mitsumi AI Agent Platform"
    API_PREFIX: str = "/api"
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    LLM_PROVIDER: str = "openai"
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""

    # AWS Bedrock
    AWS_REGION: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    # Google OAuth (Calendar + Gmail)
    GOOGLE_OAUTH_CLIENT_ID: str = ""
    GOOGLE_OAUTH_CLIENT_SECRET: str = ""

    EMBEDDING_PROVIDER: str = "openai"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    TAVILY_API_KEY: str = ""

    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    AUTH_ALLOWED_DOMAIN: str = "mitsumidistribution.com"
    OTP_EXPIRE_MINUTES: int = 10
    RESET_TOKEN_EXPIRE_MINUTES: int = 15
    OTP_MAX_ATTEMPTS: int = 5

    POSTGRES_URL: str = "postgresql+asyncpg://user:pass@postgres:5432/mitsumi"
    REDIS_URL: str = "redis://redis:6379/0"
    MONGODB_URL: str = "mongodb://mongodb:27017"
    MONGODB_DB: str = "mitsumi"

    REDIS_TTL_SECONDS: int = 7200
    REDIS_MEMORY_MAX_MESSAGES: int = 20

    DEV_AUTH_BYPASS_OTP: bool = True
    SUPERADMIN_EMAIL: str = "francis@mitsumidistribution.com"
    SUPERADMIN_NAME: str = "Francis Mitsumi"
    SUPERADMIN_PASSWORD: str = ""

    RESEND_API_KEY: str = ""
    EMAIL_FROM_NAME: str = "Mitsumi AI Platform"
    EMAIL_FROM_ADDRESS: str = "no-reply@mitsumitestlabs.com"
    EMAIL_REPLY_TO: str = "support@mitsumitestlabs.com"
    APP_BASE_URL: str = "http://localhost:3000"

    # Google Calendar (OAuth-less service account). When GOOGLE_CALENDAR_JSON
    # (inline JSON) and GOOGLE_CALENDAR_ID are set, calendar_event tool writes
    # real events; otherwise it falls back to the local JSON log.
    GOOGLE_CALENDAR_JSON: str = ""
    GOOGLE_CALENDAR_ID: str = ""
    GOOGLE_CALENDAR_TIMEZONE: str = "Africa/Nairobi"

    @property
    def is_bedrock(self) -> bool:
        return (self.LLM_PROVIDER or "").strip().lower() in ("bedrock", "aws", "aws_bedrock")

    @property
    def bedrock_ready(self) -> bool:
        return self.is_bedrock and bool(self.AWS_ACCESS_KEY_ID and self.AWS_SECRET_ACCESS_KEY and self.AWS_REGION)

    @property
    def llm_ready(self) -> bool:
        """True when the LLM provider is fully configured."""
        if self.is_bedrock:
            return self.bedrock_ready
        return bool(self.LLM_API_KEY or self.GOOGLE_API_KEY)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

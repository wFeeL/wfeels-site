from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    site_url: str = "http://localhost:4321"
    rate_limit_per_hour: int = 5
    min_fill_seconds: float = 2.0
    trust_proxy: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

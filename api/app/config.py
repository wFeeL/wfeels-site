from pydantic import HttpUrl
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    telegram_proxy_url: HttpUrl | None = None
    site_url: str = "http://localhost:4321"
    rate_limit_per_hour: int = 5
    min_fill_seconds: float = 2.0
    trust_proxy: bool = True
    leads_db_path: str = "/data/leads.sqlite3"
    lead_retention_days: int = 90
    consent_receipt_retention_days: int = 1095
    # Бот удаляет сообщение раньше суточного auto-delete таймера закрытого чата.
    telegram_retention_hours: int = 23
    telegram_retry_minutes: int = 15
    maintenance_interval_seconds: int = 300
    backup_directory: str = "/backups"
    backup_interval_hours: int = 24
    backup_retention_days: int = 7
    consent_version: str = "1.2-2026-08-24"
    privacy_version: str = "1.2-2026-08-24"
    consent_action_text: str = (
        "Даю согласие на обработку персональных данных для ответа на заявку, "
        "включая доставку копии заявки через Telegram."
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore",
    )


settings = Settings()

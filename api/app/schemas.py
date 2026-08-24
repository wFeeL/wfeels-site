from pydantic import BaseModel, Field, field_validator

# Каталог услуг — код и человекочитаемое название, дословно из заголовков
# `10-offer/SERVICES.md` (S1…S9). Второй список не заводим: коды и порядок
# совпадают с группами `web/src/data/services.ts` (Сайты · Автоматизация и
# интеграции · ИИ · Telegram), фронт берёт выпадающий список из того же
# каталога. Расширять — только правкой SERVICES.md и синхронной правкой здесь.
SERVICE_LABELS: dict[str, str] = {
    "S1": "Сайт под ключ",
    "S2": "Доработка и поддержка существующего сайта",
    "S3": "Аудит сайта",
    "S4": "ИИ-консультант по материалам бизнеса",
    "S5": "Приём заявок и интеграции",
    "S6": "Панель обращений и админка",
    "S7": "Backend и REST API",
    "S8": "Telegram-бот под задачу",
    "S9": "Telegram Mini App",
}


class LeadIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    contact: str = Field(min_length=3, max_length=120)
    # Обязательное для НОВОЙ формы (выпадающий список), но пустая строка по
    # умолчанию: заявка со старой открытой вкладки, где поля `service` ещё не
    # было, обязана дойти, а не отвергаться 422-й — лид живой, вкладка не
    # виновата в том, что открыта раньше правки. Пустая строка — это «форма
    # старая», а не «код неизвестен»: код вне каталога отвергается отдельно.
    service: str = Field(default="", max_length=4)
    # `message` было обязательным (10…4000), теперь необязательное — текст
    # переехал в новое поле «О задаче». Границы длины (10…4000), когда текст
    # присутствует, оставлены прежними: смягчена только обязательность.
    message: str = Field(default="", max_length=4000)
    budget: str | None = Field(default=None, max_length=60)
    page: str = Field(default="", max_length=200)
    website: str = Field(default="", max_length=200)  # приманка, обязана быть пустой
    consent: str = Field(default="", max_length=20)
    consent_version: str = Field(default="", max_length=40)
    privacy_version: str = Field(default="", max_length=40)
    elapsed_seconds: float = 0.0

    @field_validator("service")
    @classmethod
    def _service_must_be_known_or_empty(cls, v: str) -> str:
        if v and v not in SERVICE_LABELS:
            raise ValueError("service: код вне каталога SERVICES.md")
        return v

    @field_validator("message")
    @classmethod
    def _message_length_when_present(cls, v: str) -> str:
        if v and len(v) < 10:
            raise ValueError("message: короче 10 символов")
        return v

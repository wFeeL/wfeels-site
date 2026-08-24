import logging
from dataclasses import dataclass

import httpx2

from .config import Settings, settings

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class TelegramDelivery:
    message_id: int

# Клиент печатает в лог полный адрес запроса на уровне INFO, а в адресе Telegram
# лежит токен бота — так устроен их API, иначе с ним нельзя. Сегодня это не течёт
# только потому, что корневой логгер по умолчанию стоит на WARNING. Одной строки
# `logging.basicConfig(level=logging.INFO)` при деплое хватило бы, чтобы токен
# оказался в файле лога навсегда. Гарантия должна принадлежать коду, а не удаче.
# Гасятся оба имени: сейчас в проекте `httpx2`, но имя `httpx` остаётся живым —
# любая зависимость, вернувшая старый клиент, вернула бы и утечку.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpx2").setLevel(logging.WARNING)


async def send_lead(
    text: str,
    config: Settings = settings,
) -> TelegramDelivery | None:
    if not config.telegram_bot_token or not config.telegram_chat_id:
        # Полный текст заявки уже записан в российскую первичную базу. В журнал
        # попадает только технический факт: иначе запасной путь сам создавал бы
        # ещё одно, неуправляемое место хранения персональных данных.
        log.warning("Telegram не настроен; доставка заявки отложена")
        return None

    url = f"https://api.telegram.org/bot{config.telegram_bot_token}/sendMessage"
    proxy_url = str(config.telegram_proxy_url) if config.telegram_proxy_url else None
    try:
        # Прокси задаётся только для Telegram, а не глобально для контейнера.
        # trust_env=False не позволяет случайным HTTP_PROXY/HTTPS_PROXY молча
        # изменить маршрут и унести токен через незапланированный посредник.
        # TLS остаётся включён: HTTP-прокси лишь строит CONNECT-туннель до
        # api.telegram.org, сертификат Telegram продолжает проверяться клиентом.
        async with httpx2.AsyncClient(
            timeout=10.0,
            proxy=proxy_url,
            trust_env=False,
        ) as client:
            r = await client.post(
                url,
                json={
                    "chat_id": config.telegram_chat_id,
                    "text": text,
                    "disable_web_page_preview": True,
                },
            )
        r.raise_for_status()
        body = r.json()
        message_id = body.get("result", {}).get("message_id")
        if body.get("ok") is not True or not isinstance(message_id, int):
            raise ValueError("unexpected Telegram response")
        return TelegramDelivery(message_id=message_id)
    except Exception as exc:
        log.error("Не удалось отправить заявку в Telegram: %s", type(exc).__name__)
        return None


async def delete_lead_message(
    message_id: int,
    config: Settings = settings,
) -> bool:
    if not config.telegram_bot_token or not config.telegram_chat_id:
        log.warning("Telegram не настроен; удаление сообщения отложено")
        return False

    url = f"https://api.telegram.org/bot{config.telegram_bot_token}/deleteMessage"
    proxy_url = str(config.telegram_proxy_url) if config.telegram_proxy_url else None
    try:
        async with httpx2.AsyncClient(
            timeout=10.0,
            proxy=proxy_url,
            trust_env=False,
        ) as client:
            response = await client.post(
                url,
                json={
                    "chat_id": config.telegram_chat_id,
                    "message_id": message_id,
                },
            )
        response.raise_for_status()
        body = response.json()
        return body.get("ok") is True and body.get("result") is True
    except Exception as exc:
        log.error(
            "Не удалось удалить Telegram-сообщение: %s",
            type(exc).__name__,
        )
        return False

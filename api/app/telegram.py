import logging

import httpx

from .config import settings

log = logging.getLogger(__name__)


async def send_lead(text: str) -> bool:
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        log.warning("Telegram не настроен, заявка только в логе: %s", text)
        return False

    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                url,
                json={
                    "chat_id": settings.telegram_chat_id,
                    "text": text,
                    "disable_web_page_preview": True,
                },
            )
        r.raise_for_status()
        return True
    except Exception as exc:
        log.error("Не удалось отправить заявку в Telegram: %s", type(exc).__name__)
        return False

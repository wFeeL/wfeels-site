import logging

import pytest

from app.config import Settings
from app.telegram import send_lead


@pytest.mark.asyncio
async def test_unconfigured_telegram_does_not_log_personal_data(caplog):
    config = Settings(
        _env_file=None,
        telegram_bot_token="",
        telegram_chat_id="",
    )
    with caplog.at_level(logging.WARNING):
        result = await send_lead("Имя: Мария\nСвязь: @maria", config)

    assert result is None
    assert "Мария" not in caplog.text
    assert "@maria" not in caplog.text

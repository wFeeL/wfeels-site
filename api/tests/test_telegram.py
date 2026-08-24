import logging

import pytest
from pydantic import ValidationError

from app.config import Settings
from app.telegram import send_lead


def make_settings(**overrides) -> Settings:
    base = {
        "telegram_bot_token": "test-token",
        "telegram_chat_id": "123456",
        "site_url": "https://wfeels.site",
    }
    return Settings(_env_file=None, **{**base, **overrides})


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


@pytest.mark.asyncio
async def test_telegram_uses_configured_http_proxy(monkeypatch):
    captured: dict[str, object] = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {"ok": True, "result": {"message_id": 101}}

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            captured["client_kwargs"] = kwargs

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, json):
            captured["url"] = url
            captured["json"] = json
            return FakeResponse()

    monkeypatch.setattr("app.telegram.httpx2.AsyncClient", FakeAsyncClient)
    config = make_settings(
        telegram_proxy_url="http://proxy-user:proxy-password@proxy.example:8080"
    )

    delivery = await send_lead("Проверка", config=config)
    assert delivery is not None
    assert delivery.message_id == 101
    assert captured["client_kwargs"] == {
        "timeout": 10.0,
        "proxy": "http://proxy-user:proxy-password@proxy.example:8080/",
        "trust_env": False,
    }


@pytest.mark.asyncio
async def test_telegram_uses_direct_connection_when_proxy_is_empty(monkeypatch):
    captured: dict[str, object] = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {"ok": True, "result": {"message_id": 102}}

    class FakeAsyncClient:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, _url, json):
            return FakeResponse()

    monkeypatch.setattr("app.telegram.httpx2.AsyncClient", FakeAsyncClient)

    delivery = await send_lead("Проверка", config=make_settings())
    assert delivery is not None
    assert delivery.message_id == 102
    assert captured == {"timeout": 10.0, "proxy": None, "trust_env": False}


def test_telegram_proxy_rejects_non_http_scheme():
    with pytest.raises(ValidationError):
        make_settings(telegram_proxy_url="socks5://proxy.example:1080")

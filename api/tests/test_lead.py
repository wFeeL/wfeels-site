import pytest
from fastapi.testclient import TestClient

from app.main import create_app


VALID = {
    "name": "Мария",
    "contact": "@maria",
    "message": "Нужен сайт для груминг-салона с записью",
    "page": "/uslugi/sajt",
    "website": "",
    "consent": "on",
    "elapsed_seconds": 0.0,
}


@pytest.fixture
def sent():
    return []


@pytest.fixture
def client(monkeypatch, sent):
    async def fake_send(text: str) -> bool:
        sent.append(text)
        return True

    app = create_app(sender=fake_send, clock=lambda: 100.0)
    return TestClient(app)


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_valid_json_lead_is_accepted_and_sent(client, sent):
    r = client.post("/api/lead", json={**VALID, "elapsed_seconds": 90.0})
    assert r.status_code == 202
    assert len(sent) == 1
    assert "Мария" in sent[0]


def test_form_encoded_lead_redirects_to_thanks(client, sent):
    r = client.post(
        "/api/lead",
        data={**VALID, "elapsed_seconds": "90.0"},
        follow_redirects=False,
    )
    assert r.status_code == 303
    assert r.headers["location"].endswith("/spasibo")
    assert len(sent) == 1


def test_honeypot_is_silently_dropped(client, sent):
    r = client.post(
        "/api/lead",
        json={**VALID, "website": "http://spam", "elapsed_seconds": 90.0},
    )
    assert r.status_code == 202
    assert sent == []


def test_too_fast_submission_is_dropped(client, sent):
    r = client.post("/api/lead", json={**VALID, "elapsed_seconds": 0.5})
    assert r.status_code == 202
    assert sent == []


def test_lead_without_javascript_is_sent(client, sent):
    """Ноль означает «JavaScript выключен»: проверку на скорость пропускаем,
    иначе путь без JS отвалился бы целиком, а он поддержан намеренно."""
    r = client.post("/api/lead", json={**VALID, "elapsed_seconds": 0.0})
    assert r.status_code == 202
    assert len(sent) == 1


def test_forged_negative_elapsed_is_dropped(client, sent):
    """Живой браузер отрицательное прошедшее время выдать не может."""
    r = client.post("/api/lead", json={**VALID, "elapsed_seconds": -3600.0})
    assert r.status_code == 202
    assert sent == []


def test_lead_without_consent_is_rejected(client, sent):
    """Согласие — правовое основание собирать имя и контакт. Отвечаем ошибкой,
    а не молчанием: это отказ по существу, а не ловушка на бота."""
    payload = {**VALID, "elapsed_seconds": 90.0}
    payload.pop("consent")
    r = client.post("/api/lead", json=payload)
    assert r.status_code == 422
    assert sent == []


def test_short_message_is_rejected(client):
    r = client.post(
        "/api/lead",
        json={**VALID, "message": "привет", "elapsed_seconds": 90.0},
    )
    assert r.status_code == 422


def test_rate_limit_blocks_sixth_request(client, sent):
    for _ in range(5):
        client.post("/api/lead", json={**VALID, "elapsed_seconds": 90.0})
    r = client.post("/api/lead", json={**VALID, "elapsed_seconds": 90.0})
    assert r.status_code == 429
    assert len(sent) == 5


def test_telegram_failure_still_returns_success(monkeypatch):
    async def broken(text: str) -> bool:
        raise RuntimeError("телеграм недоступен")

    app = create_app(sender=broken, clock=lambda: 100.0)
    c = TestClient(app)
    r = c.post("/api/lead", json={**VALID, "elapsed_seconds": 90.0})
    assert r.status_code == 202


def test_browser_may_send_the_lead_from_the_site_origin(client):
    """Отправка идёт JSON-телом, а такой запрос браузер предваряет проверкой
    OPTIONS. Без разрешения источника браузер оборвёт отправку до того, как она
    уйдёт, и форма покажет ошибку при полностью исправном бэкенде."""
    r = client.options(
        "/api/lead",
        headers={
            "origin": "http://localhost:4321",
            "access-control-request-method": "POST",
            "access-control-request-headers": "content-type",
        },
    )
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == "http://localhost:4321"

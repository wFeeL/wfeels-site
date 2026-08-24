import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.storage import LeadStore
from app.telegram import TelegramDelivery


VALID = {
    "name": "Мария",
    "contact": "@maria",
    "service": "S1",
    "message": "Нужен сайт для груминг-салона с записью",
    "page": "/services/sajt",
    "website": "",
    "consent": "on",
    "consent_version": "1.3-2026-08-25",
    "privacy_version": "1.3-2026-08-25",
    "consent_locale": "ru",
    "elapsed_seconds": 0.0,
}


def make_settings(**overrides) -> Settings:
    """Настройки собираются явно и без чтения `.env`. Иначе весь набор молча
    зависел бы от того, настроена ли машина: в день, когда рядом появится
    настоящий `api/.env`, тесты предела частоты и разрешённого источника начали
    бы падать не из-за кода, а из-за конфига."""
    base = dict(
        telegram_bot_token="",
        telegram_chat_id="",
        site_url="http://localhost:4321",
        rate_limit_per_hour=5,
        min_fill_seconds=2.0,
        trust_proxy=True,
        leads_db_path=":memory:",
        backup_directory="",
        consent_version="1.3-2026-08-25",
        privacy_version="1.3-2026-08-25",
    )
    return Settings(_env_file=None, **{**base, **overrides})


@pytest.fixture
def sent():
    return []


@pytest.fixture
def make_client(sent):
    def build(**overrides) -> TestClient:
        async def fake_send(text: str) -> TelegramDelivery:
            sent.append(text)
            return TelegramDelivery(message_id=len(sent))

        return TestClient(
            create_app(
                sender=fake_send,
                clock=lambda: 100.0,
                config=make_settings(**overrides),
            )
        )

    return build


@pytest.fixture
def client(make_client):
    return make_client()


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_valid_json_lead_is_accepted_and_sent(client, sent):
    r = client.post("/api/lead", json={**VALID, "elapsed_seconds": 90.0})
    assert r.status_code == 202
    assert len(sent) == 1
    assert "Мария" in sent[0]
    assert "Бюджет:" not in sent[0]
    assert client.app.state.lead_store.count("leads") == 1
    assert client.app.state.lead_store.count("consent_receipts") == 1


def test_legacy_budget_value_is_ignored_by_new_form_contract(client, sent):
    r = client.post(
        "/api/lead",
        json={**VALID, "budget": "100 000 ₽", "elapsed_seconds": 90.0},
    )
    assert r.status_code == 202
    assert "Бюджет:" not in sent[0]
    row = client.app.state.lead_store._connect().execute(
        "SELECT budget FROM leads LIMIT 1"
    ).fetchone()
    assert row["budget"] is None


def test_english_consent_stores_the_exact_english_action(client):
    r = client.post(
        "/api/lead",
        json={**VALID, "consent_locale": "en", "elapsed_seconds": 90.0},
    )
    assert r.status_code == 202
    row = client.app.state.lead_store._connect().execute(
        "SELECT action_text FROM consent_receipts LIMIT 1"
    ).fetchone()
    assert row["action_text"] == make_settings().consent_action_text_en


def test_form_encoded_lead_redirects_to_thanks(client, sent):
    r = client.post(
        "/api/lead",
        data={**VALID, "elapsed_seconds": "90.0"},
        follow_redirects=False,
    )
    assert r.status_code == 303
    assert r.headers["location"].endswith("/thanks")
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


def test_stale_legal_document_versions_are_rejected(client, sent):
    r = client.post(
        "/api/lead",
        json={
            **VALID,
            "privacy_version": "устаревшая",
            "elapsed_seconds": 90.0,
        },
    )
    assert r.status_code == 409
    assert r.json()["status"] == "documents_changed"
    assert sent == []
    assert client.app.state.lead_store.count("leads") == 0


def test_primary_database_is_written_before_telegram():
    store = LeadStore(":memory:")
    observed_counts: list[int] = []

    async def inspect_store(_text: str) -> TelegramDelivery:
        observed_counts.append(store.count("leads"))
        return TelegramDelivery(message_id=17)

    app = create_app(
        sender=inspect_store,
        clock=lambda: 100.0,
        config=make_settings(),
        store=store,
    )
    response = TestClient(app).post(
        "/api/lead",
        json={**VALID, "elapsed_seconds": 90.0},
    )

    assert response.status_code == 202
    assert observed_counts == [1]


def test_storage_failure_does_not_fall_back_to_telegram(sent):
    async def fake_send(text: str) -> TelegramDelivery:
        sent.append(text)
        return TelegramDelivery(message_id=1)

    app = create_app(
        sender=fake_send,
        clock=lambda: 100.0,
        config=make_settings(leads_db_path="/dev/null/leads.sqlite3"),
    )
    response = TestClient(app).post(
        "/api/lead",
        json={**VALID, "elapsed_seconds": 90.0},
    )

    assert response.status_code == 503
    assert response.json()["status"] == "storage_unavailable"
    assert sent == []


def test_short_message_is_rejected(client):
    r = client.post(
        "/api/lead",
        json={**VALID, "message": "привет", "elapsed_seconds": 90.0},
    )
    assert r.status_code == 422


def test_malformed_body_is_rejected_not_crashed(client, sent):
    """Оборванное тело — это «прислали ерунду», а не «сломался сервер».
    Пятисотка тут означала бы необработанное исключение в обработчике."""
    r = client.post(
        "/api/lead",
        content="{не json".encode("utf-8"),  # b"..." не принимает не-ASCII
        headers={"content-type": "application/json"},
    )
    assert r.status_code == 422
    assert sent == []


def test_empty_body_is_rejected_not_crashed(client, sent):
    r = client.post(
        "/api/lead",
        content=b"",
        headers={"content-type": "application/json"},
    )
    assert r.status_code == 422
    assert sent == []


def test_rate_limit_blocks_sixth_request(client, sent):
    for _ in range(5):
        client.post("/api/lead", json={**VALID, "elapsed_seconds": 90.0})
    r = client.post("/api/lead", json={**VALID, "elapsed_seconds": 90.0})
    assert r.status_code == 429
    assert len(sent) == 5


def test_telegram_failure_still_returns_success():
    async def broken(text: str) -> TelegramDelivery:
        raise RuntimeError("телеграм недоступен")

    app = create_app(sender=broken, clock=lambda: 100.0, config=make_settings())
    c = TestClient(app)
    r = c.post("/api/lead", json={**VALID, "elapsed_seconds": 90.0})
    assert r.status_code == 202
    assert c.app.state.lead_store.count("leads") == 1


def test_form_failure_answers_with_a_page_not_json(make_client):
    """Браузер без JavaScript уходит на адрес API навигацией. JSON он показал бы
    как голый текст на чужом домене — тупик без объяснения и без пути назад.
    Замер до правки: посетитель видел строку `{"status":"rate_limited"}`."""
    client = make_client(rate_limit_per_hour=1)
    body = {**VALID, "elapsed_seconds": "90.0"}
    client.post("/api/lead", data=body, follow_redirects=False)
    blocked = client.post("/api/lead", data=body, follow_redirects=False)

    assert blocked.status_code == 429
    assert blocked.headers["content-type"].startswith("text/html")
    assert "Заявка не отправлена" in blocked.text
    assert "/contact" in blocked.text


def test_json_client_still_gets_json(make_client):
    """Путь с JavaScript ждёт JSON и разбирает код ответа сам — отдавать ему
    страницу нельзя."""
    client = make_client(rate_limit_per_hour=1)
    body = {**VALID, "elapsed_seconds": 90.0}
    client.post("/api/lead", json=body)
    blocked = client.post("/api/lead", json=body)

    assert blocked.status_code == 429
    assert blocked.headers["content-type"].startswith("application/json")
    assert blocked.json() == {"status": "rate_limited"}


def test_malformed_requests_still_consume_the_rate_limit(make_client, sent):
    """Счётчик стоит первым, до разбора тела. Любая проверка выше него — дыра:
    запрос, отбитый раньше счётчика, лимита не расходует, и по нему можно
    долбить бесконечно."""
    client = make_client(rate_limit_per_hour=1)
    junk = client.post(
        "/api/lead",
        content="{не json".encode("utf-8"),
        headers={"content-type": "application/json"},
    )
    assert junk.status_code == 422
    assert client.post("/api/lead", json={**VALID, "elapsed_seconds": 90.0}).status_code == 429
    assert sent == []


def test_honeypot_requests_still_consume_the_rate_limit(make_client, sent):
    """Счётчик стоит выше приманки. Иначе бот не расходует лимит и может долбить
    бесконечно — то есть защита не действует ровно против того трафика, ради
    которого поставлена."""
    client = make_client(rate_limit_per_hour=1)
    spam = {**VALID, "website": "http://spam", "elapsed_seconds": 90.0}
    assert client.post("/api/lead", json=spam).status_code == 202
    assert client.post("/api/lead", json={**VALID, "elapsed_seconds": 90.0}).status_code == 429
    assert sent == []


def test_validation_error_does_not_echo_the_submitted_value(client):
    """Ответ называет поле и вид нарушения, но не возвращает присланное.
    Иначе сообщение на двести тысяч символов вернулось бы во всей длине."""
    huge = "я" * 200_000
    r = client.post(
        "/api/lead",
        json={**VALID, "message": huge, "elapsed_seconds": 90.0},
    )
    assert r.status_code == 422
    assert huge not in r.text
    assert len(r.content) < 1000


def test_forged_negative_elapsed_is_dropped_even_without_a_threshold(make_client, sent):
    """Проверка на подделку не должна держаться на том, что порог положителен:
    при `min_fill_seconds = 0` она обязана продолжать работать.

    Замечание о силе теста. План обещал, что без отдельной строки
    `if payload.elapsed_seconds < 0` этот тест краснеет, — измерено, что нет:
    при `min_fill_seconds = 0` значение `-3600.0` истинно И меньше нуля, поэтому
    сравнение с порогом ловит его и без отдельной строки. Тест закрепляет
    поведение (подделка не уходит в Telegram ни при каком пороге), но отдельную
    строку не удерживает: она — защита от будущей правки сравнения, а не
    наблюдаемое сегодня поведение."""
    client = make_client(min_fill_seconds=0.0)
    r = client.post("/api/lead", json={**VALID, "elapsed_seconds": -3600.0})
    assert r.status_code == 202
    assert sent == []


def test_forwarded_address_is_trusted_behind_a_proxy(make_client):
    """За обратным прокси настоящий адрес посетителя приходит заголовком. Без
    его учёта счётчик видел бы всех посетителей одним адресом самого прокси и
    закрывал бы сайт для всех после пятой заявки в час."""
    client = make_client(rate_limit_per_hour=1)
    body = {**VALID, "elapsed_seconds": 90.0}
    first = client.post("/api/lead", json=body, headers={"x-forwarded-for": "1.1.1.1"})
    second = client.post("/api/lead", json=body, headers={"x-forwarded-for": "2.2.2.2"})
    assert first.status_code == 202
    assert second.status_code == 202


def test_forwarded_address_is_ignored_without_a_proxy(make_client):
    """Если прокси нет, заголовок подделает кто угодно и обнулит себе лимит
    каждым запросом. Тогда верить можно только адресу соединения."""
    client = make_client(rate_limit_per_hour=1, trust_proxy=False)
    body = {**VALID, "elapsed_seconds": 90.0}
    first = client.post("/api/lead", json=body, headers={"x-forwarded-for": "1.1.1.1"})
    second = client.post("/api/lead", json=body, headers={"x-forwarded-for": "2.2.2.2"})
    assert first.status_code == 202
    assert second.status_code == 429


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


def test_lead_with_service_shows_human_readable_label_in_message(client, sent):
    """Владелец получает заявку в мессенджер и должен сразу видеть, о чём речь:
    код `S4` ему ничего не говорит, нужно название услуги из каталога."""
    r = client.post(
        "/api/lead", json={**VALID, "service": "S4", "elapsed_seconds": 90.0}
    )
    assert r.status_code == 202
    assert "S4" not in sent[0]
    assert "ИИ-консультант" in sent[0]


def test_lead_without_service_is_still_accepted(client, sent):
    """Заявка без `service` может прийти со старой открытой вкладки формы —
    отвергать её нельзя, теряется живой лид. Поле просто не несёт названия
    услуги в сообщении."""
    payload = {**VALID, "elapsed_seconds": 90.0}
    payload.pop("service")
    r = client.post("/api/lead", json=payload)
    assert r.status_code == 202
    assert len(sent) == 1


def test_lead_with_unknown_service_code_is_rejected(client, sent):
    """`service` — код из каталога `SERVICES.md`, а не произвольная строка:
    код вне каталога — ошибка запроса, а не повод записать что попало."""
    r = client.post(
        "/api/lead", json={**VALID, "service": "S99", "elapsed_seconds": 90.0}
    )
    assert r.status_code == 422
    assert sent == []


def test_lead_without_message_is_accepted(client, sent):
    """Свободный текст переехал в необязательное поле «О задаче»: заявка без
    текста обязана проходить."""
    payload = {**VALID, "elapsed_seconds": 90.0}
    payload.pop("message")
    r = client.post("/api/lead", json=payload)
    assert r.status_code == 202
    assert len(sent) == 1


def test_short_message_is_still_rejected_when_provided(client):
    """`message` необязателен, но если он присутствует, прежние границы длины
    (10…4000) продолжают действовать — ослаблена только обязательность поля."""
    r = client.post(
        "/api/lead",
        json={**VALID, "message": "привет", "elapsed_seconds": 90.0},
    )
    assert r.status_code == 422

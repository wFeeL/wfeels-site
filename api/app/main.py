import asyncio
import logging
import time
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone
from typing import Awaitable, Callable

from html import escape

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from pydantic import ValidationError

# `Settings` импортируется рядом с синглтоном: он стоит в аннотации параметра
# `create_app`, а она вычисляется в момент определения функции.
from .config import Settings, settings
from .maintenance import maintenance_loop
from .ratelimit import RateLimiter
from .schemas import SERVICE_LABELS, LeadIn
from .storage import LeadStore, StoredLead
from .telegram import TelegramDelivery, delete_lead_message, send_lead

Sender = Callable[[str], Awaitable[TelegramDelivery | None]]
Deleter = Callable[[int], Awaitable[bool]]
log = logging.getLogger(__name__)


def error_page(site_url: str, message: str) -> str:
    """Страница отказа для отправки без JavaScript.

    Замер показал, чем оборачивается JSON на этом пути: браузер без JS уходит на
    адрес API НАВИГАЦИЕЙ, и посетитель остаётся на чужом домене перед строкой
    `{"status":"rate_limited"}` — без вёрстки, без объяснения и без пути назад.
    Стили здесь inline и примитивные намеренно: страницу отдаёт API, до таблиц
    стилей сайта он не дотягивается, а путь этот редкий и запасной.
    """
    return (
        "<!doctype html>"
        '<html lang="ru"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1">'
        '<meta name="robots" content="noindex, nofollow">'
        "<title>Заявка не отправлена</title></head>"
        '<body style="font-family: system-ui, sans-serif; max-width: 34rem;'
        ' margin: 15vh auto; padding: 0 24px; line-height: 1.6">'
        "<h1>Заявка не отправлена</h1>"
        f"<p>{escape(message)}</p>"
        f'<p><a href="{escape(site_url)}/contact">Вернуться к форме</a></p>'
        "</body></html>"
    )


def client_ip(request: Request, trust_proxy: bool) -> str:
    if trust_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def format_lead(lead: LeadIn | StoredLead) -> str:
    # Код услуги ничего не говорит владельцу в мессенджере — попадает
    # название из каталога. Пустой `service` (заявка со старой формы) даёт
    # «—», а не пустую строку: молчание о поле неотличимо от сбоя вёрстки.
    service_label = SERVICE_LABELS.get(lead.service, "—")
    parts = [
        "Новая заявка с сайта",
        f"ID: {getattr(lead, 'id', 'до записи')}",
        f"Имя: {lead.name}",
        f"Связь: {lead.contact}",
        f"Услуга: {service_label}",
        f"Страница: {lead.page or '—'}",
    ]
    # Колонка остается в SQLite ради старых записей и ожидающих повторной
    # доставки. Новая форма поле не собирает, но реальное старое значение при
    # повторе не теряется и не превращается в бессмысленное «Бюджет: —».
    budget = getattr(lead, "budget", None)
    if budget:
        parts.append(f"Бюджет: {budget}")
    parts.extend(["", lead.message or "—"])
    return "\n".join(parts)


def create_app(
    sender: Sender | None = None,
    clock: Callable[[], float] = time.time,
    config: Settings | None = None,
    store: LeadStore | None = None,
    deleter: Deleter | None = None,
) -> FastAPI:
    # Настройки принимаются третьим параметром по той же причине, что отправитель
    # и часы: без этого весь набор тестов молча зависел бы от окружения машины.
    # `settings` — синглтон, читаемый на импорте из `.env` и переменных среды,
    # и в день, когда рядом появится настоящий `api/.env` (а он появится, ради
    # него и написан `.env.example`), тесты предела частоты и разрешённого
    # источника начали бы падать — не из-за кода, а из-за конфига.
    cfg = config or settings
    lead_store = store or LeadStore(cfg.leads_db_path)
    limiter = RateLimiter(limit=cfg.rate_limit_per_hour, window_seconds=3600)

    async def configured_sender(text: str) -> TelegramDelivery | None:
        return await send_lead(text, cfg)

    async def configured_deleter(message_id: int) -> bool:
        return await delete_lead_message(message_id, cfg)

    telegram_sender = sender or configured_sender
    telegram_deleter = deleter or configured_deleter

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        task = asyncio.create_task(
            maintenance_loop(
                lead_store,
                sender=telegram_sender,
                deleter=telegram_deleter,
                formatter=format_lead,
                config=cfg,
                rate_limiter=limiter,
            )
        )
        try:
            yield
        finally:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
            lead_store.close()

    app = FastAPI(
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        lifespan=lifespan,
    )
    app.state.lead_store = lead_store

    # Отправка идёт с JSON-телом, а такой запрос браузер предваряет проверкой
    # OPTIONS. В бою Caddy проксирует /api на тот же домен и повода для проверки
    # нет, но в разработке и в тестах сайт живёт на 4321, а бэкенд на 8000 —
    # без этого блока браузер оборвёт отправку до того, как она уйдёт.
    # Разрешён ровно один источник, тот самый сайт: список origin-ов — это
    # список тех, кому позволено слать заявки от имени посетителя.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[cfg.site_url],
        allow_methods=["POST"],
        allow_headers=["content-type"],
    )

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        # Проверка считается зелёной только если первичная база доступна:
        # работающий HTTP-процесс без записи заявок для этой схемы не здоров.
        lead_store.count("leads")
        return {"status": "ok"}

    # response_model=None обязателен: без него FastAPI видит аннотацию
    # `JSONResponse | RedirectResponse` и пытается построить по ней модель ответа,
    # падая с `FastAPIError: Invalid args for response field!` ещё на импорте
    # модуля. Обработчик отдаёт готовые ответы двух разных видов, схема тут не
    # нужна вовсе.
    @app.post("/api/lead", response_model=None)
    async def lead(request: Request) -> JSONResponse | RedirectResponse | HTMLResponse:
        content_type = request.headers.get("content-type", "")
        wants_redirect = "application/x-www-form-urlencoded" in content_type
        now = clock()

        # Отказ отвечает в том виде, в каком клиент способен его прочитать.
        # Запрос с JavaScript ждёт JSON и разбирает код сам. А браузер без JS
        # уходит сюда навигацией, и JSON он показал бы как голый текст на чужом
        # домене — тупик без объяснения и без пути назад. Замер подтвердил: при
        # исчерпанном лимите посетитель без JS видел строку `rate_limited`.
        def fail(status: int, code: str, message: str, **extra):
            if wants_redirect:
                return HTMLResponse(
                    error_page(cfg.site_url, message), status_code=status
                )
            return JSONResponse({"status": code, **extra}, status_code=status)

        # Счётчик частоты стоит ПЕРВЫМ, до разбора тела. Он считает запросы с
        # адреса, а не их содержимое, и любая проверка выше него — это дыра:
        # запрос, отбитый до счётчика, лимита не расходует, и по нему можно
        # долбить бесконечно. Пока счётчик стоял ниже разбора и согласия,
        # замер показывал ровно это — пять битых тел и пять запросов без
        # согласия не тратили ни единицы лимита.
        if not limiter.allow(client_ip(request, cfg.trust_proxy), now=now):
            return fail(
                429,
                "rate_limited",
                "С вашего адреса пришло слишком много заявок. "
                "Попробуйте ещё раз через час или напишите напрямую.",
            )

        # Тело разбирается до валидации, и разбор тоже умеет падать: пустое тело,
        # оборванный JSON, чужой content-type. Без перехвата это уходит наружу
        # пятисоткой, то есть «сломался сервер» вместо «прислали ерунду».
        try:
            raw = (
                dict(await request.form())
                if wants_redirect
                else await request.json()
            )
        except ValueError:
            return fail(
                422,
                "malformed",
                "Не удалось прочитать заявку. Отправьте форму ещё раз.",
            )

        # Валидируем вручную, потому что тело приходит в двух форматах.
        # Без явного перехвата ValidationError улетела бы наружу как 500.
        try:
            payload = LeadIn.model_validate(raw)
        except ValidationError as exc:
            # Возвращаем поле и вид нарушения, но НЕ само присланное значение.
            # `exc.errors()` кладёт в ответ ключ `input` целиком: сообщение на
            # двести тысяч символов вернулось бы обратно во всей длине.
            return fail(
                422,
                "invalid",
                "Заявка не прошла проверку. Загляните в поля и отправьте снова.",
                errors=[
                    {
                        "field": ".".join(str(p) for p in e["loc"]),
                        "reason": e["type"],
                    }
                    for e in exc.errors(include_url=False)
                ],
            )

        accepted = JSONResponse({"status": "accepted"}, status_code=202)
        # Значение поля приходит от клиента и недоверенно, поэтому в путь редиректа
        # никогда не подставляется само присланное значение — только явный выбор
        # из ровно двух заранее известных страниц. Любое значение, кроме точного
        # "en" (проверка на равенство, а не на пригодность строки), ведёт на
        # русскую страницу — так же, как уже выбирается текст согласия чуть ниже.
        thanks_path = "/en/thanks" if payload.consent_locale == "en" else "/thanks"
        redirect = RedirectResponse(f"{cfg.site_url}{thanks_path}", status_code=303)
        ok = redirect if wants_redirect else accepted

        # Согласие на обработку персональных данных — правовое основание собирать
        # имя и контакт. Браузер требует галочку сам, но запрос можно послать и
        # мимо браузера, поэтому проверяем здесь же. Отвечаем честной ошибкой, а
        # не молчанием: это не ловушка на бота, а отказ по существу.
        if not payload.consent.strip():
            return fail(
                422,
                "consent_required",
                "Без согласия на обработку персональных данных заявку "
                "принять нельзя.",
            )

        # Согласие связано с теми редакциями документов, которые человек видел
        # возле формы. Старая вкладка после обновления не должна молча получить
        # новую версию задним числом: просим перезагрузить страницу.
        if (
            payload.consent_version != cfg.consent_version
            or payload.privacy_version != cfg.privacy_version
        ):
            return fail(
                409,
                "documents_changed",
                "Документы формы обновились. Перезагрузите страницу и "
                "подтвердите актуальное согласие.",
            )

        # Приманка и слишком быстрая отправка: молча принимаем и ничего не шлём.
        # Отвечать ошибкой нельзя — так бот узнает, что его раскусили.
        if payload.website.strip():
            return ok

        # Отрицательное прошедшее время живой браузер выдать не может — это
        # подделка. Проверка стоит отдельной строкой, а не растворяется в
        # сравнении ниже: иначе она держалась бы на том, что порог положителен,
        # и тихо исчезла бы в день, когда `min_fill_seconds` выставят в ноль.
        if payload.elapsed_seconds < 0:
            return ok
        # Ноль — это «JavaScript выключен», проверку пропускаем: иначе отвалился
        # бы весь путь без JS. Абсолютных отметок времени здесь нет намеренно,
        # см. врезку к задаче.
        if payload.elapsed_seconds and payload.elapsed_seconds < cfg.min_fill_seconds:
            return ok

        # Сначала российская первичная база, затем Telegram. Если SQLite
        # недоступен, Telegram не становится скрытым обходным хранилищем.
        received_at = datetime.fromtimestamp(now, timezone.utc)
        try:
            stored = lead_store.record_lead(
                payload,
                received_at=received_at,
                lead_retention_days=cfg.lead_retention_days,
                consent_receipt_retention_days=cfg.consent_receipt_retention_days,
                telegram_retry_minutes=cfg.telegram_retry_minutes,
                action_text=(
                    cfg.consent_action_text_en
                    if payload.consent_locale == "en"
                    else cfg.consent_action_text_ru
                ),
            )
        except Exception as exc:
            log.error("Не удалось записать заявку: %s", type(exc).__name__)
            return fail(
                503,
                "storage_unavailable",
                "Заявка временно не принимается. Попробуйте ещё раз позже "
                "или свяжитесь напрямую.",
            )

        try:
            delivery = await telegram_sender(format_lead(stored))
        except Exception as exc:
            delivery = None
            error_code = type(exc).__name__
        else:
            error_code = "delivery_failed"

        if delivery is None:
            lead_store.mark_telegram_retry(
                stored.id,
                now=received_at,
                retry_minutes=cfg.telegram_retry_minutes,
                error_code=error_code,
            )
        else:
            lead_store.mark_telegram_sent(
                stored.id,
                message_id=delivery.message_id,
                sent_at=received_at,
                retention_hours=cfg.telegram_retention_hours,
            )

        return ok

    return app


app = create_app()

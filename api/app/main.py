import time
from typing import Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import ValidationError

# `Settings` импортируется рядом с синглтоном: он стоит в аннотации параметра
# `create_app`, а она вычисляется в момент определения функции.
from .config import Settings, settings
from .ratelimit import RateLimiter
from .schemas import LeadIn
from .telegram import send_lead

Sender = Callable[[str], Awaitable[bool]]


def client_ip(request: Request, trust_proxy: bool) -> str:
    if trust_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def format_lead(lead: LeadIn) -> str:
    parts = [
        "Новая заявка с сайта",
        f"Имя: {lead.name}",
        f"Связь: {lead.contact}",
        f"Страница: {lead.page or '—'}",
        f"Бюджет: {lead.budget or '—'}",
        "",
        lead.message,
    ]
    return "\n".join(parts)


def create_app(
    sender: Sender = send_lead,
    clock: Callable[[], float] = time.time,
    config: Settings | None = None,
) -> FastAPI:
    # Настройки принимаются третьим параметром по той же причине, что отправитель
    # и часы: без этого весь набор тестов молча зависел бы от окружения машины.
    # `settings` — синглтон, читаемый на импорте из `.env` и переменных среды,
    # и в день, когда рядом появится настоящий `api/.env` (а он появится, ради
    # него и написан `.env.example`), тесты предела частоты и разрешённого
    # источника начали бы падать — не из-за кода, а из-за конфига.
    cfg = config or settings
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

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

    limiter = RateLimiter(limit=cfg.rate_limit_per_hour, window_seconds=3600)

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    # response_model=None обязателен: без него FastAPI видит аннотацию
    # `JSONResponse | RedirectResponse` и пытается построить по ней модель ответа,
    # падая с `FastAPIError: Invalid args for response field!` ещё на импорте
    # модуля. Обработчик отдаёт готовые ответы двух разных видов, схема тут не
    # нужна вовсе.
    @app.post("/api/lead", response_model=None)
    async def lead(request: Request) -> JSONResponse | RedirectResponse:
        content_type = request.headers.get("content-type", "")
        wants_redirect = "application/x-www-form-urlencoded" in content_type

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
            return JSONResponse({"status": "malformed"}, status_code=422)

        # Валидируем вручную, потому что тело приходит в двух форматах.
        # Без явного перехвата ValidationError улетела бы наружу как 500.
        try:
            payload = LeadIn.model_validate(raw)
        except ValidationError as exc:
            # Возвращаем поле и вид нарушения, но НЕ само присланное значение.
            # `exc.errors()` кладёт в ответ ключ `input` целиком: сообщение на
            # двести тысяч символов вернулось бы обратно во всей длине.
            return JSONResponse(
                {
                    "status": "invalid",
                    "errors": [
                        {
                            "field": ".".join(str(p) for p in e["loc"]),
                            "reason": e["type"],
                        }
                        for e in exc.errors(include_url=False)
                    ],
                },
                status_code=422,
            )

        now = clock()
        accepted = JSONResponse({"status": "accepted"}, status_code=202)
        redirect = RedirectResponse(f"{cfg.site_url}/spasibo", status_code=303)
        ok = redirect if wants_redirect else accepted

        # Согласие на обработку персональных данных — правовое основание собирать
        # имя и контакт. Браузер требует галочку сам, но запрос можно послать и
        # мимо браузера, поэтому проверяем здесь же. Отвечаем честной ошибкой, а
        # не молчанием: это не ловушка на бота, а отказ по существу.
        if not payload.consent.strip():
            return JSONResponse({"status": "consent_required"}, status_code=422)

        # Счётчик частоты стоит ВЫШЕ приманки намеренно. Если пропускать бота
        # мимо счётчика, он не расходует лимит и может долбить бесконечно —
        # то есть защита не действует ровно против того трафика, ради которого
        # поставлена. Лимит считает запросы с адреса, а не их содержимое.
        if not limiter.allow(client_ip(request, cfg.trust_proxy), now=now):
            return JSONResponse({"status": "rate_limited"}, status_code=429)

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

        try:
            await sender(format_lead(payload))
        except Exception:
            # Заявку нельзя терять из-за чужого сбоя: она уже в логе отправителя.
            pass

        return ok

    return app


app = create_app()

import time
from typing import Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import ValidationError

from .config import settings
from .ratelimit import RateLimiter
from .schemas import LeadIn
from .telegram import send_lead

Sender = Callable[[str], Awaitable[bool]]


def client_ip(request: Request) -> str:
    if settings.trust_proxy:
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
) -> FastAPI:
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    # Отправка идёт с JSON-телом, а такой запрос браузер предваряет проверкой
    # OPTIONS. В бою Caddy проксирует /api на тот же домен и повода для проверки
    # нет, но в разработке и в тестах сайт живёт на 4321, а бэкенд на 8000 —
    # без этого блока браузер оборвёт отправку до того, как она уйдёт.
    # Разрешён ровно один источник, тот самый сайт: список origin-ов — это
    # список тех, кому позволено слать заявки от имени посетителя.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.site_url],
        allow_methods=["POST"],
        allow_headers=["content-type"],
    )

    limiter = RateLimiter(limit=settings.rate_limit_per_hour, window_seconds=3600)

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    # response_model=None обязателен: из аннотации `JSONResponse | RedirectResponse`
    # FastAPI пытается собрать модель ответа и падает ещё на импорте модуля.
    @app.post("/api/lead", response_model=None)
    async def lead(request: Request) -> JSONResponse | RedirectResponse:
        content_type = request.headers.get("content-type", "")
        wants_redirect = "application/x-www-form-urlencoded" in content_type

        raw = (
            dict(await request.form())
            if wants_redirect
            else await request.json()
        )

        # Валидируем вручную, потому что тело приходит в двух форматах.
        # Без явного перехвата ValidationError улетела бы наружу как 500.
        try:
            payload = LeadIn.model_validate(raw)
        except ValidationError as exc:
            return JSONResponse(
                {"status": "invalid", "errors": exc.errors(include_url=False)},
                status_code=422,
            )

        now = clock()
        accepted = JSONResponse({"status": "accepted"}, status_code=202)
        redirect = RedirectResponse(f"{settings.site_url}/spasibo", status_code=303)
        ok = redirect if wants_redirect else accepted

        # Согласие на обработку персональных данных — правовое основание собирать
        # имя и контакт. Браузер требует галочку сам, но запрос можно послать и
        # мимо браузера, поэтому проверяем здесь же. Отвечаем честной ошибкой, а
        # не молчанием: это не ловушка на бота, а отказ по существу.
        if not payload.consent.strip():
            return JSONResponse({"status": "consent_required"}, status_code=422)

        # Приманка и слишком быстрая отправка: молча принимаем и ничего не шлём.
        # Отвечать ошибкой нельзя — так бот узнает, что его раскусили.
        if payload.website.strip():
            return ok
        # Ноль — это «JavaScript выключен», проверку пропускаем. Отрицательное
        # значение живой браузер выдать не может: это подделка, роняем молча.
        # Абсолютных отметок времени здесь нет намеренно, см. врезку к задаче.
        if payload.elapsed_seconds and payload.elapsed_seconds < settings.min_fill_seconds:
            return ok

        if not limiter.allow(client_ip(request), now=now):
            return JSONResponse({"status": "rate_limited"}, status_code=429)

        try:
            await sender(format_lead(payload))
        except Exception:
            # Заявку нельзя терять из-за чужого сбоя: она уже в логе отправителя.
            pass

        return ok

    return app


app = create_app()

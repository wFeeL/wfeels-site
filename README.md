# wfeels — сайт-портфолио v3

Astro 7 (статика) + маленький FastAPI для формы заявки и демо-чата.
Спека: `FREELANCE_LAUNCH/70-workshop/specs/site-v3/`.

## Запуск

    cd web && npm install && npm run dev      # http://localhost:4321
    cd api && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
    cd api && .venv/bin/uvicorn app.main:app --port 8000

## Проверки

    cd web && npm run build && npm run test:unit && npm run test:e2e
    cd api && .venv/bin/pytest

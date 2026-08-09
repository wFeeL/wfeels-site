import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests/e2e',
  use: { baseURL: 'http://localhost:4321' },
  webServer: [
    {
      command: 'npm run build && npm run preview',
      env: {
        // Preview-сервер Astro не проксирует /api, а переменная зашивается на
        // этапе `astro build`, не в рантайме. Без неё форма отправилась бы на
        // localhost:4321/api/lead и получила 404. В проде переменная пустая:
        // запрос идёт на тот же домен, где его подхватывает Caddy.
        PUBLIC_API_BASE: 'http://localhost:8000',
        // Astro 7 определяет запуск из-под ИИ-агента (пакет am-i-vibing) и уводит
        // preview в фоновый демон — процесс завершается, и Playwright считает, что
        // сервер упал. Переменная выключает это автоопределение и оставляет сервер
        // на переднем плане. Для человека и для CI она безвредна: там детектор и так
        // не срабатывает. Источник: astro/dist/cli/preview/index.js, строка
        // `agentDetected = !process.env.ASTRO_PREVIEW_BACKGROUND && isRunByAgent()`.
        ASTRO_PREVIEW_BACKGROUND: '1',
        // Витрина компонентов не входит в боевую сборку (`lib/dev-pages.ts`), а
        // здесь она нужна: на ней стоят проверки примитивов, тем и полосы
        // прогресса. Флаг ставится только тут — боевая сборка его не знает.
        DEV_PAGES: '1',
      },
      url: 'http://localhost:4321',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: '.venv/bin/uvicorn app.main:app --port 8000',
      cwd: '../api',
      env: {
        // Адрес редиректа на /spasibo при отправке без JavaScript, он же
        // единственный разрешённый источник для CORS.
        SITE_URL: 'http://localhost:4321',
        // Счётчик частоты живёт в памяти процесса, а `reuseExistingServer`
        // намеренно оставляет процесс жить между прогонами. При боевом пределе
        // в пять заявок третий подряд локальный прогон начал бы получать 429 —
        // тест падал бы по накопленной истории, а не по коду. Сам предел
        // проверяется юнит-тестами задачи 9, здесь он только мешает.
        RATE_LIMIT_PER_HOUR: '1000',
      },
      url: 'http://localhost:8000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});

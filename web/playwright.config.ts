import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests/e2e',
  use: { baseURL: 'http://localhost:4321' },
  webServer: {
    command: 'npm run build && npm run preview',
    // Astro 7 определяет запуск из-под ИИ-агента (пакет am-i-vibing) и уводит
    // preview в фоновый демон — процесс завершается, и Playwright считает, что
    // сервер упал. Переменная выключает это автоопределение и оставляет сервер
    // на переднем плане. Для человека и для CI она безвредна: там детектор и так
    // не срабатывает. Источник: astro/dist/cli/preview/index.js, строка
    // `agentDetected = !process.env.ASTRO_PREVIEW_BACKGROUND && isRunByAgent()`.
    env: { ASTRO_PREVIEW_BACKGROUND: '1' },
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

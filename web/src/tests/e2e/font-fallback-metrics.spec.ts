import { test, expect, type Browser } from '@playwright/test';

/* Сторож FOUC-подгонки запасных начертаний (правка 2026-08-21, диагноз —
 * заголовок и метка бренда «прыгают» при подмене `system-ui` на настоящий
 * шрифт после его загрузки). Метрики подобраны в `fonts.css` (`Unbounded
 * Fallback`/`Onest Fallback`/`JetBrains Mono Fallback`) так, чтобы коробка
 * запасного начертания заранее совпадала с коробкой настоящего.
 *
 * Мерит ИТОГ, а не намерение: не ищет `size-adjust` в CSS (наличие
 * свойства ничего не говорит о том, верно ли оно подобрано — легко вписать
 * произвольное число и пройти такую проверку), а грузит страницу ДВАЖДЫ
 * в одном прогоне — один раз с заблокированными `*.woff2` (что видит
 * посетитель до и во время `font-display: swap`, включая период, когда
 * навигация уже разрешена и лейаут посчитан на запасном начертании), один
 * раз как обычно, дожидаясь `document.fonts.ready`, — и сравнивает реальную
 * раскладку `getBoundingClientRect()`/`scrollHeight`. Тот же метод и те же
 * селекторы, что у измерительного скрипта `fout.mjs` (корень копии), которым
 * подбирались числа в `fonts.css`.
 *
 * Пороги — из приёмки задачи: `h1` высота ≤4 px (было 79,03 без подгонки),
 * `header .brand` ширина ≤4 px (было 25,63), высота документа ≤16 px (было
 * 157). Красноту проверяли вручную: временный откат `--font-head` в
 * `tokens.css` к `'Unbounded Variable', system-ui, sans-serif` (без звена
 * `Unbounded Fallback`) уронил этот тест с `h1`-расхождением ~79 px —
 * числа те же, что до всей правки, потому что без калиброванного звена
 * запасное начертание — голый `system-ui`, тот же дефект, что был раньше. */

const SELECTORS = { h1: 'h1', brand: 'header .brand' } as const;

const THRESHOLDS = {
  h1HeightPx: 4,
  brandWidthPx: 4,
  docHeightPx: 16,
} as const;

type Measured = {
  h1: { w: number; h: number };
  brand: { w: number; h: number };
  docHeight: number;
};

async function measure(browser: Browser, baseURL: string, blockFonts: boolean): Promise<Measured> {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    // Безголовый Chromium по умолчанию просит `prefers-reduced-motion:
    // reduce` (см. `50-code/CLAUDE.md`, ловушка 5) — здесь нужен обычный
    // путь с движением, тот же, что видит живой посетитель.
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  if (blockFonts) {
    await page.route('**/*.woff2', (route) => route.abort());
  }
  await page.goto(new URL('/', baseURL).toString(), { waitUntil: 'load' });
  if (!blockFonts) {
    await page.evaluate(() => document.fonts.ready);
  }
  // Тот же отступ, что у `fout.mjs`: даёт осесть шрифту/раскладке после
  // навигации, не привязан к какой-то конкретной анимации страницы.
  await page.waitForTimeout(300);
  const out = await page.evaluate((sel) => {
    const box = (selector: string) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    };
    return {
      h1: box(sel.h1),
      brand: box(sel.brand),
      docHeight: document.documentElement.scrollHeight,
    };
  }, SELECTORS);
  await ctx.close();
  if (!out.h1 || !out.brand) {
    throw new Error('не нашёлся h1 или header .brand — сторож проверяет не тот селектор');
  }
  return out as Measured;
}

test.describe('FOUC — расхождение раскладки при подмене запасного начертания на настоящее', () => {
  test('h1 / header .brand / высота документа — в пределах приёмки', async ({ browser, baseURL }) => {
    test.skip(!baseURL, 'нет baseURL — playwright.config не поднял сервер');

    const withFonts = await measure(browser, baseURL!, false);
    const noFonts = await measure(browser, baseURL!, true);

    const h1Diff = Math.abs(withFonts.h1.h - noFonts.h1.h);
    const brandDiff = Math.abs(withFonts.brand.w - noFonts.brand.w);
    const docDiff = Math.abs(withFonts.docHeight - noFonts.docHeight);

    expect(
      h1Diff,
      `h1: без шрифта ${noFonts.h1.h.toFixed(2)} px, со шрифтом ${withFonts.h1.h.toFixed(2)} px`,
    ).toBeLessThanOrEqual(THRESHOLDS.h1HeightPx);

    expect(
      brandDiff,
      `header .brand: без шрифта ${noFonts.brand.w.toFixed(2)} px, со шрифтом ${withFonts.brand.w.toFixed(2)} px`,
    ).toBeLessThanOrEqual(THRESHOLDS.brandWidthPx);

    expect(
      docDiff,
      `высота документа: без шрифта ${noFonts.docHeight} px, со шрифтом ${withFonts.docHeight} px`,
    ).toBeLessThanOrEqual(THRESHOLDS.docHeightPx);
  });
});

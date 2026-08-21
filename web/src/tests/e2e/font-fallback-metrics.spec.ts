import { test, expect, type Browser } from '@playwright/test';

/* Сторож FOUC-подгонки запасных начертаний (заведён 2026-08-21, диагноз —
 * заголовок и метка бренда «прыгают» при подмене `system-ui` на настоящий
 * шрифт после его загрузки; расширен 2026-08-22 после того, как владелец
 * поймал дефект на 1000 px, а первая версия сторожа проверяла ОДНУ ширину
 * (1440) — та самая причина, по которой прыжок доехал до владельца, хотя
 * дизайн-ревью 2026-08-21 его уже видело. Полоса ширин ниже — из приёмки
 * задачи «прыжок на перезагрузке», не придумана заново.
 *
 * Мерит ИТОГ на каждой ширине отдельно, а не намерение: не ищет
 * `size-adjust` в CSS (наличие свойства ничего не говорит о том, верно ли
 * оно подобрано), а грузит страницу ДВАЖДЫ на каждой ширине в одном
 * прогоне — один раз с заблокированными `*.woff2` (что видит посетитель до
 * и во время `font-display: swap`), один раз как обычно, дожидаясь
 * `document.fonts.ready`, — и сравнивает реальную раскладку
 * `getBoundingClientRect()`/`scrollHeight`. Тот же метод и те же селекторы,
 * что у измерительного скрипта калибровки (временный, не входит в комплект),
 * которым подбирались числа в `fonts.css`.
 *
 * Пороги — из приёмки задачи 2026-08-22: `h1` высота ≤4 px, `header .brand`
 * ширина ≤4 px, высота документа ≤24 px, на КАЖДОЙ из двенадцати ширин
 * ниже — не только на концах полосы, как проверялось раньше.
 *
 * ИЗВЕСТНЫЙ, ОБЪЯСНЁННЫЙ, НЕ УСТРАНЁННЫЙ ЭТОЙ ПРАВКОЙ ОСТАТОК (см. разбор в
 * `fonts.css`, комментарий у `Onest Fallback`): секции «Прайсинг» и «Обо
 * мне» держат расхождение высоты −24…−59 px НЕЗАВИСИМО от `size-adjust`
 * `Onest Fallback` на всём проверенном диапазоне 90…110% (и от `Unbounded
 * Fallback`/`JetBrains Mono Fallback` на ещё более широких диапазонах,
 * правка 2026-08-21) — перенос там происходит не по ширине текста Onest, и
 * причина не найдена (не `ch`-контейнер `.caption`/`Pricing.astro` —
 * проверено целенаправленно самосогласованной калибровкой 109,63%, эффекта
 * нет). Это оставляет ширину документа за порогом ≤24 px на части полосы
 * (390, 480, 1000, 1100, 1180, 1280, 1440, 1600, 1920 px на момент этой
 * правки, подробные числа — в отчёте задачи, не здесь). Тест ниже проверяет
 * `h1` и `header .brand` на всех двенадцати ширинах (обе метрики держат
 * ≤4 px или лучше — это то, что удалось исправить полностью), а высоту
 * документа — тоже на всех двенадцати, честно: там, где остаток не устранён,
 * тест красный, и это осознанно, не недосмотр. Ослаблять порог, чтобы
 * скрыть остаток, нельзя — тест обязан мерить то же, что и приёмка. */

const SELECTORS = { h1: 'h1', brand: 'header .brand' } as const;

const THRESHOLDS = {
  h1HeightPx: 4,
  brandWidthPx: 4,
  docHeightPx: 24,
} as const;

const WIDTHS = [390, 480, 600, 768, 900, 1000, 1100, 1180, 1280, 1440, 1600, 1920] as const;

type Measured = {
  h1: { w: number; h: number };
  brand: { w: number; h: number };
  docHeight: number;
};

async function measure(
  browser: Browser,
  baseURL: string,
  width: number,
  blockFonts: boolean,
): Promise<Measured> {
  const ctx = await browser.newContext({
    viewport: { width, height: 1000 },
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
  // Даёт осесть шрифту/раскладке после навигации, не привязан к какой-то
  // конкретной анимации страницы.
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
  for (const width of WIDTHS) {
    test(`h1 / header .brand / высота документа на ${width}px`, async ({ browser, baseURL }) => {
      test.skip(!baseURL, 'нет baseURL — playwright.config не поднял сервер');

      const withFonts = await measure(browser, baseURL!, width, false);
      const noFonts = await measure(browser, baseURL!, width, true);

      const h1Diff = Math.abs(withFonts.h1.h - noFonts.h1.h);
      const brandDiff = Math.abs(withFonts.brand.w - noFonts.brand.w);
      const docDiff = Math.abs(withFonts.docHeight - noFonts.docHeight);

      expect(
        h1Diff,
        `h1 @${width}px: без шрифта ${noFonts.h1.h.toFixed(2)} px, со шрифтом ${withFonts.h1.h.toFixed(2)} px`,
      ).toBeLessThanOrEqual(THRESHOLDS.h1HeightPx);

      expect(
        brandDiff,
        `header .brand @${width}px: без шрифта ${noFonts.brand.w.toFixed(2)} px, со шрифтом ${withFonts.brand.w.toFixed(2)} px`,
      ).toBeLessThanOrEqual(THRESHOLDS.brandWidthPx);

      expect(
        docDiff,
        `высота документа @${width}px: без шрифта ${noFonts.docHeight} px, со шрифтом ${withFonts.docHeight} px ` +
          '(известный остаток «Прайсинг»/«Обо мне» — см. fonts.css, комментарий у Onest Fallback)',
      ).toBeLessThanOrEqual(THRESHOLDS.docHeightPx);
    });
  }
});

import { test, expect } from '@playwright/test';

/* Объёмная вставка фото в «Обо мне» (пункт 6 списка правок 2026-08-14).
 *
 * Приём взят у `portfolio-site/src/pages/home/Hero.jsx:13-45` (GSAP там),
 * пересобран без GSAP (D-024): части 1 и 2 — CSS-анимация на загрузке
 * (`clip-path` + `translate`), часть 3 — свой `<script>`, наклон за курсором
 * только на `pointer: fine`.
 *
 * Headless Chromium в этом репозитории по умолчанию отдаёт
 * `prefers-reduced-motion: reduce` (см. `case-weight-motion.spec.ts`) —
 * поэтому проверка «движение реально происходит» идёт отдельным контекстом
 * с явным `reducedMotion: 'no-preference'`, а не на дефолтной `page`.
 * Иначе тест «появление» проверял бы запасное состояние вместо шторки и
 * проходил бы вхолостую при сломанной анимации — тот же класс ошибки,
 * что уже ловили в `card-motion.spec.ts`. */

const WIDE = { width: 1440, height: 900 };
const PHOTO = '[data-about-photo]';
const WRAP = '[data-about-photo-wrap]';

/** Читает вторую (единственную процентную) координату `clip-path: inset(...)`. */
function clipBottomPct(clipPath: string): number {
  const m = clipPath.match(/(\d+(?:\.\d+)?)%/);
  return m ? Number(m[1]) : NaN;
}

test.describe('«Обо мне»: шторка на загрузке', () => {
  test('no-preference — фото раскрывается шторкой, а не сразу целиком', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: WIDE });
    const page = await context.newPage();
    await page.goto('/');

    const photo = page.locator(PHOTO);
    const clipEarly = await photo.evaluate((el) => getComputedStyle(el).clipPath);
    const pctEarly = clipBottomPct(clipEarly);
    expect(pctEarly, `сразу после загрузки clip-path уже полностью открыт (${clipEarly}) — ` +
      'шторка не сыграла, либо анимация не применяется вовсе').toBeGreaterThan(0);

    // Задержка 0,25 с + длительность 1,1 с — ждём с запасом и проверяем
    // конечное состояние: полностью раскрыто.
    await page.waitForTimeout(1700);
    const clipLate = await photo.evaluate((el) => getComputedStyle(el).clipPath);
    expect(clipBottomPct(clipLate), `фото не раскрылось полностью: ${clipLate}`).toBe(0);

    await context.close();
  });

  test('reduce — фото видно целиком сразу, без ожидания', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: WIDE });
    const page = await context.newPage();
    await page.goto('/');

    const photo = page.locator(PHOTO);
    const clip = await photo.evaluate((el) => getComputedStyle(el).clipPath);
    expect(clipBottomPct(clip), `при prefers-reduced-motion фото обязано быть открыто сразу: ${clip}`)
      .toBe(0);

    await context.close();
  });
});

test.describe('«Обо мне»: наклон за курсором', () => {
  test('pointer: fine — наклон реально применяется и сбрасывается при уходе курсора', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');

    const fine = await page.evaluate(() => window.matchMedia('(pointer: fine)').matches);
    expect(fine, 'тест предполагает pointer: fine у обычного десктопного контекста').toBe(true);

    await page.locator(WRAP).scrollIntoViewIfNeeded();
    const box = await page.locator(WRAP).boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width * 0.9, box!.y + box!.height * 0.1);
    await page.waitForTimeout(600); // сглаживание наклона — 0,5 с

    const tilted = await page.locator(PHOTO).evaluate((el) => getComputedStyle(el).transform);
    expect(tilted, 'наклон не применился при движении курсора внутри обёртки').not.toBe('none');

    await page.mouse.move(10, 10);
    await page.waitForTimeout(600);
    const reset = await page.locator(PHOTO).evaluate((el) => getComputedStyle(el).transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)'], `наклон не вернулся в ноль после ухода курсора: ${reset}`)
      .toContain(reset);
  });

  test('pointer: coarse (телефон) — наклона нет', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto('/');

    const fine = await page.evaluate(() => window.matchMedia('(pointer: fine)').matches);
    expect(fine, 'контекст обязан эмулировать грубый указатель, иначе тест ничего не проверяет')
      .toBe(false);

    await page.locator(WRAP).scrollIntoViewIfNeeded();
    const box = await page.locator(WRAP).boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + 10, box!.y + 10);
    await page.waitForTimeout(200);

    const transform = await page.locator(PHOTO).evaluate((el) => getComputedStyle(el).transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)'], `на pointer: coarse наклон применился: ${transform}`)
      .toContain(transform);

    await context.close();
  });

  test('без JavaScript — фото видно и стоит на месте', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: WIDE });
    const page = await context.newPage();
    await page.goto('/');

    const photo = page.locator(PHOTO);
    await expect(photo).toBeVisible();
    const box = await photo.boundingBox();
    expect(box!.width, 'фото без JS обязано занимать место в раскладке').toBeGreaterThan(0);
    expect(box!.height, 'фото без JS обязано занимать место в раскладке').toBeGreaterThan(0);

    const transform = await photo.evaluate((el) => getComputedStyle(el).transform);
    expect(['none', 'matrix(1, 0, 0, 1, 0, 0)'], `без JS у фото не должно быть наклона: ${transform}`)
      .toContain(transform);

    await context.close();
  });
});

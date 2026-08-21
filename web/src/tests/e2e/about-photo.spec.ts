import { test, expect } from '@playwright/test';

/* Объёмная вставка фото в «Обо мне» (пункт 6 списка правок 2026-08-14).
 *
 * Приём взят у `portfolio-site/src/pages/home/Hero.jsx:13-45` (GSAP там),
 * пересобран без GSAP (D-024): части 1 и 2 — CSS-анимация на загрузке,
 * часть 3 — свой `<script>`, наклон за курсором только на `pointer: fine`.
 *
 * Часть 1 («шторка») переработана 2026-08-21 (задача «пролагивает при
 * листании»): было `clip-path` на самом фото, стало — див `.photo-curtain`
 * поверх фото, уезжающий `translate`-ом. Причина в шапке `About.astro`:
 * анимация `clip-path` не композитится Chromium и перерисовывает фото на
 * каждом кадре. Проверка ниже смотрит на РЕЗУЛЬТАТ — фактическое положение
 * шторки (`translate` по Y, читаемый из `getComputedStyle`, а не сам факт
 * наличия какого-то свойства в CSS): 0% — шторка целиком перекрывает фото,
 * 100% — целиком ушла за нижний край рамки (которая её обрезает, `overflow:
 * clip`) и фото открыто. `elementFromPoint`-хиттест здесь не годится: секция
 * «Обо мне» ниже сгиба, страница не прокручена, и точка физически вне
 * вьюпорта — расчёт применим к `getComputedStyle`, но не к геометрии экрана.
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
const CURTAIN = '.photo-curtain';

/** Читает Y-компонент `translate` шторки в процентах (`getComputedStyle`
 *  сохраняет проценты как есть, не резолвит в px — проверено). */
async function curtainTranslateYPct(page: import('@playwright/test').Page): Promise<number> {
  const translate = await page.locator(CURTAIN).evaluate((el) => getComputedStyle(el).translate);
  const m = translate.match(/(-?\d+(?:\.\d+)?)%/);
  return m ? Number(m[1]) : NaN;
}

test.describe('«Обо мне»: шторка на загрузке', () => {
  test('no-preference — фото раскрывается шторкой, а не сразу целиком', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: WIDE });
    const page = await context.newPage();
    await page.goto('/');

    const early = await curtainTranslateYPct(page);
    expect(early, `сразу после загрузки шторка уже ушла (translate ${early}%) — ` +
      'приём не сыграл, либо анимация не применяется вовсе').toBeLessThan(100);

    // Задержка 0,25 с + длительность 1,1 с — ждём с запасом и проверяем
    // конечное состояние: шторка полностью ушла за рамку.
    await page.waitForTimeout(1700);
    const late = await curtainTranslateYPct(page);
    expect(late, `фото не раскрылось полностью: шторка на translate ${late}%`).toBe(100);

    await context.close();
  });

  test('reduce — фото видно целиком сразу, без ожидания', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: WIDE });
    const page = await context.newPage();
    await page.goto('/');

    const pct = await curtainTranslateYPct(page);
    expect(pct, `при prefers-reduced-motion шторка обязана стоять на 100% сразу: ${pct}%`).toBe(100);

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

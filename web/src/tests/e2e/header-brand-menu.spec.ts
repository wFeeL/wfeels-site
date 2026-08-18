import { test, expect } from '@playwright/test';

/* Находка 1 дизайн-ревью (БЛОКЕР, история): раскрывашка «Меню» (`.nav-narrow`,
 * `Header.astro`) вставала `position: absolute; left: 92px` — число,
 * посчитанное под Manrope. Со сменой `--font-head` на Unbounded Variable
 * (`tokens.css`) знак «wfeels» раздался с 71,27 до 95,6328125px, его правый
 * край сдвинулся 87,27 → 111,6328125px — и обогнал старое `left: 92px`:
 * последняя буква «s» знака печаталась поверх «М» слова «Меню», пересечение
 * 19,63px. Первое лечение прятало текст подписи на ≤479px (`.menu-text`
 * sr-only) — это отменяло закреплённое решение о подписанной цели нажатия
 * (`shell.spec.ts`, «текст органов управления стоит по центру и там, где
 * шапка узкая») и не убирало саму причину: `left` оставался числом,
 * посчитанным под конкретный шрифт.
 *
 * Действующее лечение — раскрывашка встала обычным flex-элементом строки
 * `.bar`, между знаком и `.tools` (разметка и стили — `Header.astro`),
 * подпись «Меню» видна ВСЕГДА. Тест меряет фактические
 * `getBoundingClientRect()`, а не структуру CSS: число может снова
 * разойтись с реальной шириной знака при следующей смене шрифта или
 * начертания, и только замер это ловит. */

const WIDTHS = [320, 360, 390, 430, 479] as const;

test.describe('знак бренда и раскрывашка «Меню» не пересекаются на телефоне', () => {
  for (const width of WIDTHS) {
    test(`${width}px: раскрывашка стоит правее знака, а не поверх него`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');

      const geometry = await page.evaluate(() => {
        const brand = document.querySelector('.brand');
        const nav = document.querySelector('.nav-narrow');
        if (!brand || !nav) return null;
        const b = brand.getBoundingClientRect();
        const n = nav.getBoundingClientRect();
        return { brandRight: b.right, brandTop: b.top, brandBottom: b.bottom,
                 navLeft: n.left, navTop: n.top, navBottom: n.bottom };
      });

      expect(geometry, 'не нашлись знак или раскрывашка').not.toBeNull();
      const overlapsVertically = geometry!.brandTop < geometry!.navBottom
        && geometry!.navTop < geometry!.brandBottom;
      if (overlapsVertically) {
        expect(
          geometry!.navLeft,
          `на ${width}px раскрывашка (left ${geometry!.navLeft}) начинается ЛЕВЕЕ ` +
            `правого края знака (${geometry!.brandRight}) — знак и «Меню» пересекаются`,
        ).toBeGreaterThanOrEqual(geometry!.brandRight);
      }
    });

    test(`${width}px: цель нажатия раскрывашки не мельче 44×44px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');

      const box = await page.locator('.nav-narrow summary').boundingBox();
      expect(box, 'кнопка «Меню» не отрисована').not.toBeNull();
      expect(box!.width, `ширина цели нажатия на ${width}px`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `высота цели нажатия на ${width}px`).toBeGreaterThanOrEqual(44);
    });

    test(`${width}px: слово «Меню» видно глазу, не только читалке`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');

      const summary = page.locator('.nav-narrow summary');
      await expect(summary).toHaveText('Меню');
      const box = await summary.boundingBox();
      expect(box, 'кнопка «Меню» не отрисована').not.toBeNull();
      // Строка видна целиком: коробка шире одинокого треугольника-индикатора.
      expect(box!.width, `цель нажатия на ${width}px не шире декоративного треугольника`).toBeGreaterThan(44);
    });
  }

  test('на 320px нет горизонтальной прокрутки', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow, 'на 320px страница шире вьюпорта — горизонтальная прокрутка').toBe(false);
  });
});

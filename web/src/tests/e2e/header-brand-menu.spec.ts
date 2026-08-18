import { test, expect } from '@playwright/test';

/* Находка 1 дизайн-ревью (БЛОКЕР): раскрывашка «Меню» (`.nav-narrow`,
 * `Header.astro`) вставала `position: absolute; left: 92px` — число,
 * посчитанное под Manrope. Со сменой `--font-head` на Unbounded Variable
 * (`tokens.css`) знак «wfeels» раздался с 71,27 до 95,6328125px, его правый
 * край сдвинулся 87,27 → 111,6328125px — и обогнал старое `left: 92px`:
 * последняя буква «s» знака печаталась поверх «М» слова «Меню», пересечение
 * 19,63px (полный расчёт — комментарий у блока дефекта в `Header.astro`).
 *
 * Тест меряет фактические `getBoundingClientRect()`, а не структуру CSS:
 * число может снова разойтись с реальной шириной знака при следующей смене
 * шрифта или начертания, и только замер это ловит. Пять ширин — тот же
 * список, что и в `nav-narrow-tap.spec.ts` (320 — единственная, где поле
 * между знаком и `.tools` тесно: 40,37px на кнопку из label+chevron
 * 55,8125px, отсюда `.menu-text` уходит в `sr-only` и `.tools` поджимает
 * зазор 10 → 4px — см. комментарий в `Header.astro`). */

const WIDTHS = [320, 360, 390, 430, 479] as const;

test.describe('знак бренда и раскрывашка «Меню» не пересекаются на телефоне', () => {
  for (const width of WIDTHS) {
    test(`${width}px: раскрывашка стоит правее знака, а не поверх него`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');

      const geometry = await page.evaluate(() => {
        const brand = document.querySelector('.brand');
        const nav = document.querySelector('.nav-narrow');
        const tools = document.querySelector('.tools');
        if (!brand || !nav || !tools) return null;
        const b = brand.getBoundingClientRect();
        const n = nav.getBoundingClientRect();
        const t = tools.getBoundingClientRect();
        return { brandRight: b.right, navLeft: n.left, navRight: n.right, toolsLeft: t.left };
      });

      expect(geometry, 'не нашлись знак, раскрывашка или переключатели').not.toBeNull();
      expect(
        geometry!.navLeft,
        `на ${width}px раскрывашка (left ${geometry!.navLeft}) начинается ЛЕВЕЕ ` +
          `правого края знака (${geometry!.brandRight}) — знак и «Меню» пересекаются`,
      ).toBeGreaterThanOrEqual(geometry!.brandRight);
      expect(
        geometry!.navRight,
        `на ${width}px раскрывашка (right ${geometry!.navRight}) заходит на ` +
          `.tools (left ${geometry!.toolsLeft})`,
      ).toBeLessThanOrEqual(geometry!.toolsLeft);
    });

    test(`${width}px: цель нажатия раскрывашки не мельче 44×44px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');

      const box = await page.locator('.nav-narrow summary').boundingBox();
      expect(box, 'кнопка «Меню» не отрисована').not.toBeNull();
      expect(box!.width, `ширина цели нажатия на ${width}px`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `высота цели нажатия на ${width}px`).toBeGreaterThanOrEqual(44);
    });
  }

  test('текст «Меню» остаётся в доступном имени кнопки, даже когда скрыт визуально', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const summary = page.locator('.nav-narrow summary');
    await expect(summary).toHaveText('Меню');

    const width = await summary.locator('.menu-text').evaluate((el) => el.getBoundingClientRect().width);
    expect(width, 'подпись «Меню» видна глазу на 390px — на этой ширине она обязана быть sr-only').toBeLessThanOrEqual(1);
  });

  test('от 480px подпись «Меню» видна как обычно (sr-only действует только ≤479px)', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await page.goto('/');

    const width = await page
      .locator('.menu-text')
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(width, 'на 600px подпись «Меню» должна быть видна целиком').toBeGreaterThan(20);
  });
});

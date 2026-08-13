import { test, expect } from '@playwright/test';

/* Спека 02-texts.md, секция 1: «Строка регалий (моно, ровно пять пунктов):
 * ... При `label` (11 px, капслок, трекинг .16em) символ занимает ≈8,4 px;
 * пять пунктов дают ≈900 px при контейнере 1180 px, шестой ломает строку».
 * Проверяется фактической шириной элемента, а не на глаз (план, задача 5).
 *
 * Контейнер (`tokens.css`, `--container: 1180px`, возвращён владельцем
 * 2026-08-13 после замера — узкий 1060 px давал вдвое больше переносов)
 * достигает объявленного максимума при вьюпорте заметно шире него —
 * 1440 выбран той же шириной, на которой снимаются десктопные скриншоты
 * приёмки. */
test.describe('первый экран — строка регалий не переносится при контейнере 1180 px', () => {
  test('пять пунктов стоят в одну строку, контейнер на объявленном максимуме', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const containerWidth = await page.locator('main .container').first()
      .evaluate((el) => el.getBoundingClientRect().width);
    // Допуск на дробный пиксель браузера, не на смысловое отклонение.
    expect(containerWidth, 'контейнер обязан быть на объявленном максимуме 1180 px')
      .toBeGreaterThan(1178);
    expect(containerWidth).toBeLessThan(1182);

    const regalia = page.locator('#hero [data-regalia]');
    await expect(regalia).toBeVisible();

    const items = regalia.locator('.item');
    await expect(items).toHaveCount(5);

    const tops = await items.evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().top)));
    const first = tops[0];
    for (const top of tops) {
      expect(Math.abs(top - first), `пункты регалий на разных строках: [${tops.join(', ')}]`)
        .toBeLessThanOrEqual(1);
    }

    // Фактическая ширина строки регалий целиком — число для отчёта приёмки,
    // не только факт «не перенеслась».
    // Ширина именно занятого содержимым отрезка (от левого края первого
    // пункта до правого края последнего), а не ширина блока `<p>` — блок
    // всегда равен ширине контейнера независимо от того, уместился текст в
    // одну строку или нет, и не показал бы разницу.
    const regaliaContentWidth = await items.evaluateAll((els) => {
      const first = els[0].getBoundingClientRect();
      const last = els[els.length - 1].getBoundingClientRect();
      return last.right - first.left;
    });
    expect(regaliaContentWidth, 'пять пунктов обязаны уместиться в контейнер')
      .toBeLessThan(containerWidth);
  });
});

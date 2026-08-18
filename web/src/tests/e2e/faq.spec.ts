import { test, expect } from '@playwright/test';

/* Находка 3 дизайн-ревью: до правки владельца 2026-08-18 (пункт 11) низ
 * панели `.panel` совпадал с низом секции, и `border-bottom` последнего
 * пункта FAQ отделяли от края панели 96px нижнего поля секции — черта
 * читалась одна. После правки у `.panel` собственное поле 32px на 1440px
 * (`Section.astro`), и черта последнего пункта плюс обвод панели легли на
 * расстоянии 32px друг от друга — читаются как удвоенная линия.
 *
 * Тест проверяет фактическую геометрию — последний пункт списка не несёт
 * `border-bottom`, поэтому единственная черта у самого низа `.panel` — это
 * её собственный обвод, а не пара линий подряд. */
test.describe('FAQ — под последним вопросом одна черта, а не две', () => {
  test('у последнего пункта нет собственного border-bottom', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto('/');

    const lastItem = page.locator('#faq .item').last();
    await expect(lastItem).toHaveCSS('border-bottom-width', '0px');
  });

  test('у пунктов до последнего border-bottom остаётся — разделитель между вопросами не пропал', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto('/');

    const items = page.locator('#faq .item');
    const count = await items.count();
    expect(count, 'секция 10 несёт пять вопросов').toBe(5);

    for (let i = 0; i < count - 1; i++) {
      await expect(items.nth(i)).not.toHaveCSS('border-bottom-width', '0px');
    }
  });

  test('низ последнего пункта и обвод панели не сходятся в две параллельные черты на 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await page.goto('/');

    const geometry = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('#faq .item'));
      const last = items[items.length - 1];
      const panel = document.querySelector('#faq .panel');
      if (!last || !panel) return null;
      return {
        lastItemBottom: last.getBoundingClientRect().bottom,
        panelBottom: panel.getBoundingClientRect().bottom,
      };
    });

    expect(geometry, 'не нашлись последний пункт FAQ или панель').not.toBeNull();
    // Единственная черта у низа — обвод панели: низ последнего пункта
    // (без своей черты) должен лежать строго ВЫШЕ обвода панели, а не
    // рисовать вторую линию рядом с ним.
    expect(
      geometry!.lastItemBottom,
      `низ последнего пункта (${geometry!.lastItemBottom}) должен быть выше обвода панели (${geometry!.panelBottom})`,
    ).toBeLessThan(geometry!.panelBottom);
  });
});

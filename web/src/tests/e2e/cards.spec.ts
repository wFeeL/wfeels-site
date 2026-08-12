import { test, expect } from '@playwright/test';

/* Полировка перед приёмкой (2026-08-12), находка 2: карточки одного ряда
 * одной высоты, а их нижняя строка стека (моношрифт) — нет, потому что текст
 * над ней разной длины. Причина не в вёрстке самих карточек, а в войне
 * специфичности: `CaseCard.astro`/`ServiceCard.astro` красили `.card` в
 * `:global(.card){display:flex;...}`, а собственное скоупленное правило
 * `Card.astro` — `.card[data-astro-cid-…]{display:block}` — специфичнее
 * (класс+атрибут против голого класса) и тихо побеждало: `.card` оставалась
 * `display:block`, и `margin-top:auto` у строки стека ничего не делал в
 * обычном потоке. Починка — проп `stack` у `Card.astro` (см. комментарий
 * там же), который красит `.card` в его собственном скоупе, без войны
 * специфичности. Тесты ниже проверяют результат геометрией, а не наличием
 * класса — так же, как рельс проверяет вертикаль точек `rail.spec.ts`. */

const WIDE = { width: 1280, height: 900 };

test.describe('карточки — строка стека прижата к низу и совпадает в ряду', () => {
  test('карточки кейсов (секция 5): все три строки стека на одной линии', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');

    const stacks = page.locator('#cases .grid .stack');
    await expect(stacks).toHaveCount(3);

    const tops = await stacks.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().top),
    );
    const spread = Math.max(...tops) - Math.min(...tops);
    expect(spread, `верхние края строк стека: ${tops.join(', ')}`).toBeLessThan(1);
  });

  test('карточки услуг (секция 3): строки стека совпадают в каждом ряду 2×2', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');

    const stacks = page.locator('#services .grid .stack');
    await expect(stacks).toHaveCount(4);

    const tops = await stacks.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().top),
    );
    // Два ряда по два — верхний край совпадает попарно, не у всех четырёх
    // сразу (второй ряд у второй карточки на общем экране может стоять
    // ниже первой, если её контент выше — сравниваем ряд с рядом).
    const [row1, row2] = [[tops[0], tops[1]], [tops[2], tops[3]]];
    for (const row of [row1, row2]) {
      const spread = Math.max(...row) - Math.min(...row);
      expect(spread, `ряд: ${row.join(', ')}`).toBeLessThan(1);
    }
  });

  test('`.card` карточки кейса — реально flex-колонка, а не подмена display', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');
    const display = await page
      .locator('#cases .grid > a.card')
      .first()
      .evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe('flex');
  });
});

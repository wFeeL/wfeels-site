import { test, expect } from '@playwright/test';

test('полоса растёт при прокрутке', async ({ page }) => {
  await page.goto('/dev/ui');

  const bar = page.locator('#reading-progress > i');
  await expect(bar).toHaveCount(1);

  // Страница обязана быть длиннее экрана, иначе тест ничего не проверяет.
  const scrollable = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight
  );
  expect(scrollable).toBeGreaterThan(200);

  const before = await bar.evaluate((el) => el.getBoundingClientRect().width);
  expect(before).toBeLessThan(5);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect
    .poll(() => bar.evaluate((el) => el.getBoundingClientRect().width))
    .toBeGreaterThan(before);
});

// До задачи 2 плана «Главная» `/` была одним нескролящимся экраном без
// секций, и полосу для неё намеренно отключали (`progress={false}`). С задачи
// 4 главная несёт рельс (`components/Rail.astro`, `tests/e2e/rail.spec.ts`):
// полоса и рельс делят одну и ту же ширину экрана по общей точке перелома
// 1600 px, поэтому полоса остаётся в разметке всегда (её прячет только CSS,
// не проп `progress`) — план запрещает состояние «ни рельса, ни полосы» при
// любой ширине. Какая из двух видна на какой ширине — проверяет rail.spec.ts;
// здесь только факт, что элемент не выпал из DOM вовсе.
test('на главной полоса прогресса присутствует в разметке', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#reading-progress')).toHaveCount(1);
});

test('при отключённой анимации полоса всё равно показывает прогресс',
  async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/dev/ui');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect
      .poll(() =>
        page.locator('#reading-progress > i')
          .evaluate((el) => el.getBoundingClientRect().width)
      )
      .toBeGreaterThan(5);
    await ctx.close();
  });

test('на узком экране полосу не перекрывает шапка', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/dev/ui');
  await page.evaluate(() => window.scrollTo(0, 600));

  // Полоса обязана быть верхним элементом в своей точке. Если она уедет под
  // липкую шапку с непрозрачным фоном, elementFromPoint вернёт шапку, а не её.
  const onTop = await page.evaluate(() => {
    const el = document.querySelector('#reading-progress');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + 4, r.top + r.height / 2);
    return Boolean(hit && hit.closest('#reading-progress'));
  });
  expect(onTop).toBe(true);
});

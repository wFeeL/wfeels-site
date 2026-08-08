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

test('на главной полосы нет', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#reading-progress')).toHaveCount(0);
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

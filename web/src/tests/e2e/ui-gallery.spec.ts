import { test, expect } from '@playwright/test';

test('витрина показывает все примитивы', async ({ page }) => {
  await page.goto('/dev/ui');
  for (const id of ['buttons', 'cards', 'metrics', 'fields', 'type', 'colors', 'prose']) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
});

test('витрина закрыта от индексации', async ({ page }) => {
  await page.goto('/dev/ui');
  await expect(page.locator('meta[name="robots"]'))
    .toHaveAttribute('content', 'noindex, nofollow');
});

test('витрина читается в обеих темах', async ({ page }) => {
  await page.goto('/dev/ui');
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    const contrast = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { bg: s.backgroundColor, fg: s.color };
    });
    expect(contrast.bg).not.toBe(contrast.fg);
  }
});

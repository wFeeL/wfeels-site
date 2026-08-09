import { test, expect } from '@playwright/test';

const PAGES = ['/politika', '/oferta', '/soglasie'];

for (const path of PAGES) {
  test(`${path} отдаётся и закрыт от индексации`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]'))
      .toHaveAttribute('content', 'noindex, nofollow');
  });

  test(`${path} честно помечен как черновик`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('[data-draft-notice]')).toBeVisible();
  });
}

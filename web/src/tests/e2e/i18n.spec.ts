import { test, expect } from '@playwright/test';

test('английская главная отдаётся с правильным lang', async ({ page }) => {
  await page.goto('/en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toHaveText('wfeels');
});

test('переключатель ведёт с русской главной на английскую и обратно',
  async ({ page }) => {
    await page.goto('/');
    await page.locator('a.lang').click();
    await expect(page).toHaveURL(/\/en$/);
    await page.locator('a.lang').click();
    await expect(page).toHaveURL(/localhost:4321\/$/);
  });

// Зелёный только после задачи 11, где появляется /politika.
test.fixme('с одноязычной страницы переключатель ведёт на английскую главную, а не в 404',
  async ({ page }) => {
    await page.goto('/politika');
    const link = page.locator('a.lang');
    await expect(link).toHaveAttribute('href', '/en');
    await expect(link).toHaveAttribute('title', /нет на английском/);
  });

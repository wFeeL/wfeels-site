import { test, expect } from '@playwright/test';

test('главная отдаётся и содержит имя бренда', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('wfeels');
  await expect(page).toHaveTitle(/wfeels/);
});

test('атрибут lang русский', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
});

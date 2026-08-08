import { test, expect } from '@playwright/test';

test('skip-link — первый в фокусе и уводит к основному содержимому',
  async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveAttribute('href', '#main');
    await focused.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
  });

test('в шапке пять пунктов навигации', async ({ page }) => {
  await page.goto('/');
  const links = page.locator('header nav a');
  await expect(links).toHaveCount(5);
  await expect(links.nth(0)).toHaveText('Услуги');
});

test('в подвале есть юридические ссылки и строка про ИИ', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer a[href="/politika"]')).toBeVisible();
  await expect(page.locator('footer a[href="/oferta"]')).toBeVisible();
  await expect(page.locator('footer a[href="/soglasie"]')).toBeVisible();
  await expect(page.locator('footer')).toContainText('вместе с ИИ');
});

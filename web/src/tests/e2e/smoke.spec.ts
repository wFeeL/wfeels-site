import { test, expect } from '@playwright/test';

// До задачи 2 плана «Главная» вся страница была одним словом «wfeels» в
// заголовке, и тест проверял ровно это. Теперь `/` — одиннадцать секций
// (`lib/sections.ts`), и заголовок первого экрана — заглушка задачи 2, а не
// имя бренда: оно живёт в шапке и не меняется от того, что содержимое секций
// ещё не утверждено. Проверяется то же самое по сути — «страница отдаётся, и
// имя бренда на ней видно» — но там, где имя бренда сейчас и правда стоит.
test('главная отдаётся, и в шапке виден знак бренда', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/wfeels/);
  await expect(page.locator('header .brand')).toHaveText('wfeels');
  await expect(page.locator('main h1')).toBeVisible();
});

test('атрибут lang русский', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
});

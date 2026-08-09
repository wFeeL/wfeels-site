import { test, expect, type Page } from '@playwright/test';

const fill = async (page: Page) => {
  await page.fill('input[name="name"]', 'Мария');
  await page.fill('input[name="contact"]', '@maria');
  await page.fill('textarea[name="message"]', 'Нужен сайт для груминг-салона с записью');
  await page.check('input[name="consent"]');
};

test('форма отправляется при выключенном JavaScript', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/kontakt');
  await fill(page);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/spasibo$/);
  await ctx.close();
});

test('с JavaScript результат показывается на месте, без перезагрузки', async ({ page }) => {
  await page.goto('/kontakt');
  await fill(page);
  await page.click('button[type="submit"]');
  await expect(page.locator('[data-form-status="success"]')).toBeVisible();
  await expect(page).toHaveURL(/\/kontakt$/);
});

test('при недоступном бэкенде показывается ошибка и прямая ссылка на Telegram',
  async ({ page }) => {
    await page.route('**/api/lead', (route) => route.abort());
    await page.goto('/kontakt');
    await fill(page);
    await page.click('button[type="submit"]');
    await expect(page.locator('[data-form-status="error"]')).toBeVisible();
    await expect(page.locator('[data-form-status="error"] a[href^="https://t.me/"]'))
      .toBeVisible();
  });

test('поле-приманка убрано с глаз и от скринридеров', async ({ page }) => {
  await page.goto('/kontakt');
  const hp = page.locator('input[name="website"]');

  // Ловушка обязана остаться в разметке: наивный бот заполняет всё подряд и на
  // этом попадается. Поэтому её не прячут `display: none`, а уводят за край
  // экрана. Playwright считает такой элемент ВИДИМЫМ — у него ненулевой
  // прямоугольник, а `opacity: 0` видимости не отменяет, — поэтому `toBeHidden()`
  // дал бы здесь ложный красный при полностью верной вёрстке.
  await expect(hp).not.toBeInViewport();

  // Одного `not.toBeInViewport()` мало: он проходит и тогда, когда приманка
  // просто оказалась ниже сгиба длинной страницы. Замер это показал — с
  // выброшенным правилом `.hp` тест остался зелёным. Поэтому рядом стоит
  // утверждение о том, ЧЕМ она убрана: уводом за левый край окна.
  const box = await hp.boundingBox();
  expect(box, 'приманка не отрисована вовсе').not.toBeNull();
  expect(box!.x + box!.width, 'приманка не уведена за край экрана').toBeLessThan(0);

  await expect(hp).toHaveAttribute('tabindex', '-1');
  await expect(hp).toHaveAttribute('aria-hidden', 'true');
  await expect(hp).toHaveAttribute('autocomplete', 'off');
});

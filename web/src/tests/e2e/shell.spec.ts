import { test, expect } from '@playwright/test';

test('skip-link — первый в фокусе, уводит к содержимому и это видно',
  async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveAttribute('href', '#main');
    await expect(focused).toBeVisible(); // при фокусе выезжает из-за края

    await focused.press('Enter');
    const main = page.locator('#main');
    await expect(main).toBeFocused();

    // Переход должен быть заметен глазу, а не только программе.
    const shadow = await main.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).not.toBe('none');
  });

test('на десктопе в шапке пять пунктов навигации', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const links = page.locator('header nav.nav-wide a');
  await expect(links).toHaveCount(5);
  await expect(links.nth(0)).toHaveText('Услуги');
  await expect(page.locator('header details.nav-narrow')).toBeHidden();
});

test('на узком экране те же пять пунктов достижимы через раскрывашку',
  async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');

    await expect(page.locator('header nav.nav-wide')).toBeHidden();

    const menu = page.locator('header details.nav-narrow');
    await expect(menu).toBeVisible();
    const links = menu.locator('a');
    await expect(links).toHaveCount(5);
    // toBeHidden() на локаторе с несколькими элементами падает по strict
    // mode (не оценивает видимость, а сразу требует ровно один элемент),
    // поэтому проверяем каждую ссылку отдельно.
    for (const link of await links.all()) {
      await expect(link).toBeHidden();
    }

    await menu.locator('summary').click();
    await expect(links).toHaveCount(5);
    await expect(links.nth(0)).toBeVisible();
    await expect(links.nth(0)).toHaveText('Услуги');
    await expect(links.nth(4)).toHaveText('Обо мне');
  });

test('раскрывашка открывается с клавиатуры', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  const menu = page.locator('header details.nav-narrow');
  await menu.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('open', '');
  await expect(menu.locator('a').first()).toBeVisible();
});

test('в подвале есть юридические ссылки и строка про ИИ', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer a[href="/politika"]')).toBeVisible();
  await expect(page.locator('footer a[href="/oferta"]')).toBeVisible();
  await expect(page.locator('footer a[href="/soglasie"]')).toBeVisible();
  await expect(page.locator('footer')).toContainText('вместе с ИИ');
});

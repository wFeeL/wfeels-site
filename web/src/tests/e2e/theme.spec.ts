import { test, expect } from '@playwright/test';

test.describe('темы', () => {
  test('системная тёмная применяется без выбора пользователя', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('/');
    const bg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(14, 20, 32)'); // --bg тёмной темы #0E1420
    await ctx.close();
  });

  test('выбор пользователя перекрывает системную настройку и переживает перезагрузку',
    async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme: 'dark' });
      const page = await ctx.newPage();
      await page.goto('/');
      await page.getByRole('button', { name: /тема/i }).click(); // system -> light
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      const bg = await page.evaluate(() =>
        getComputedStyle(document.body).backgroundColor);
      expect(bg).toBe('rgb(244, 246, 249)'); // --bg светлой темы #F4F6F9
      await ctx.close();
    });

  test('выбор применяется сразу после загрузки документа', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'light' });
    const page = await ctx.newPage();
    // Сначала переходим, потом пишем в хранилище: addInitScript выполняется до
    // создания документа целевого origin, и localStorage там может быть недоступен.
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
    await page.reload({ waitUntil: 'commit' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await ctx.close();
  });

  test('скрипт темы стоит в разметке раньше стилей — вспышке неоткуда взяться',
    async ({ request }) => {
      const html = await (await request.get('/')).text();
      const script = html.indexOf("localStorage.getItem('theme')");
      const style = html.search(/<link[^>]+rel=["']stylesheet["']/);
      expect(script).toBeGreaterThan(-1);
      // Если стилей в разметке нет вовсе (всё заинлайнено) — проверка неприменима.
      if (style > -1) expect(script).toBeLessThan(style);
    });
});

test('у страницы есть знак бренда', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);

  const href = await page
    .locator('link[rel="icon"]')
    .getAttribute('href');
  expect(href).toBe('/favicon.svg');

  const icon = await page.request.get('/favicon.svg');
  expect(icon.status()).toBe(200);
  expect(icon.headers()['content-type']).toContain('svg');

  // Буква обязана остаться контуром. <text> рисуется шрифтом машины, которая
  // открыла файл: на чужом устройстве монограмма поедет, и молча.
  const svg = await icon.text();
  expect(svg).toContain('<path');
  expect(svg).not.toContain('<text');
});

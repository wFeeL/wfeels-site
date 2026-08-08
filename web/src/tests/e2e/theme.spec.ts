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
      expect(bg).toBe('rgb(251, 252, 253)'); // --bg светлой темы #FBFCFD
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

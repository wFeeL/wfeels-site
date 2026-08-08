import { test, expect } from '@playwright/test';

test('заголовок набран Manrope, текст — Golos Text, метка — JetBrains Mono',
  async ({ page }) => {
    await page.goto('/');
    const fam = (sel: string) =>
      page.locator(sel).evaluate((el) => getComputedStyle(el).fontFamily);

    expect(await fam('h1')).toContain('Manrope');
    expect(await fam('body')).toContain('Golos Text');
    expect(await fam('.t-label')).toContain('JetBrains Mono');
  });

test('ни один ресурс не грузится с внешнего домена', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    // data: и blob: — не сетевые запросы, у них пустой host; их пропускаем.
    if (!['http:', 'https:'].includes(url.protocol)) return;
    if (url.host !== 'localhost:4321') external.push(r.url());
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(external).toEqual([]);
});

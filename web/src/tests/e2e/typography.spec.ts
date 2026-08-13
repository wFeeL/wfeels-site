/* Порт берётся из baseURL конфига, а не зашит числом: с 2026-08-13 по
   репозиторию работают параллельные git-worktree, у каждой копии свой порт
   (`SITE_PORT`). Зашитый 4321 делал этот тест красным в любой копии, кроме
   основной, — то есть проверка ломалась не от кода, а от места запуска. */
import { test, expect } from '@playwright/test';

test('заголовок набран Manrope, текст — Golos Text, метка — JetBrains Mono',
  async ({ page }) => {
    const fam = (sel: string) =>
      page.locator(sel).first().evaluate((el) => getComputedStyle(el).fontFamily);

    await page.goto('/');
    expect(await fam('h1')).toContain('Manrope');
    expect(await fam('body')).toContain('Golos Text');

    // Метка проверяется на `/contact`, не на главной: с задачи 2 плана
    // «Главная» одиннадцать секций `/` несут только заголовки-заглушки без
    // метки (текст ещё не утверждён владельцем) — `.t-label` там сейчас нет
    // ни у одной секции. Сам класс и его шрифт от этого не меняются, и
    // страница с меткой на сайте по-прежнему есть.
    await page.goto('/contact');
    expect(await fam('.t-label')).toContain('JetBrains Mono');
  });

test('ни один ресурс не грузится с внешнего домена', async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    // data: и blob: — не сетевые запросы, у них пустой host; их пропускаем.
    if (!['http:', 'https:'].includes(url.protocol)) return;
    if (url.host !== new URL(baseURL!).host) external.push(r.url());
  });
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(external).toEqual([]);
});

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

  /* Состояний у переключателя ДВА: светлая и тёмная. Третьего, «системного», у
     кнопки нет — владелец снял его. Системная настройка при этом осталась
     начальным значением: тот, кто ничего не выбирал, видит тему своей системы,
     и метки на документе нет вовсе. */
  test('нажатие всегда даёт конкретную тему, третьего состояния нет',
    async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme: 'dark' });
      const page = await ctx.newPage();
      await page.goto('/');
      const html = page.locator('html');

      // Выбора не было: тему задаёт система, документ не помечен — значит
      // страница продолжает следовать за системой, а не за замороженной копией.
      await expect(html).not.toHaveAttribute('data-theme');

      const btn = page.getByRole('button', { name: /тема/i });
      // Круг из двух шагов. Раньше третьим нажатием возвращалось состояние без
      // метки — «системная»; теперь такого шага быть не должно ни на каком.
      for (const expected of ['light', 'dark', 'light', 'dark']) {
        await btn.click();
        await expect(html).toHaveAttribute('data-theme', expected);
        expect(
          await page.evaluate(() => localStorage.getItem('theme')),
          'выбор не записан конкретной темой',
        ).toBe(expected);
      }
      await ctx.close();
    });

  test('без выбора кнопка называет и показывает тему системы', async ({ browser }) => {
    for (const [scheme, name] of [['dark', 'темная'], ['light', 'светлая']] as const) {
      const ctx = await browser.newContext({ colorScheme: scheme });
      const page = await ctx.newPage();
      await page.goto('/');

      const btn = page.locator('#theme-toggle');
      await expect(btn).toHaveAttribute('aria-label', `Тема оформления: ${name}`);
      // Значок рисуют стили теми же ветками, что и палитру, — до первого кадра
      // и без участия скрипта.
      await expect(page.locator(`#theme-toggle .icon.${scheme}`)).toBeVisible();
      await expect(
        page.locator(`#theme-toggle .icon.${scheme === 'dark' ? 'light' : 'dark'}`),
      ).toBeHidden();
      await ctx.close();
    }
  });

  test('выбор пользователя перекрывает системную настройку и переживает перезагрузку',
    async ({ browser }) => {
      const ctx = await browser.newContext({ colorScheme: 'dark' });
      const page = await ctx.newPage();
      await page.goto('/');
      await page.getByRole('button', { name: /тема/i }).click(); // тёмная -> светлая
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

  test('схема цветов объявлена и меняется вместе с темой', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    const scheme = () =>
      page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);

    await page.goto('/contact');
    // Без объявления схемы браузер рисует поля выбора, скроллбары и подложку
    // автозаполнения по светлым правилам поверх тёмной палитры.
    expect(await scheme()).toBe('dark');

    await page.evaluate(() => localStorage.setItem('theme', 'light'));
    await page.reload();
    expect(await scheme()).toBe('light');
    await ctx.close();
  });

  test('чекбокс согласия красится акцентом темы, а не системным', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'light' });
    const page = await ctx.newPage();
    const accent = () =>
      page.locator('input[name="consent"]')
        .evaluate((el) => getComputedStyle(el).accentColor);

    await page.goto('/contact');
    // При `auto` отмеченный чекбокс красится системным акцентом ОС: у гостя
    // с розовым акцентом на «Чертеже» появился бы розовый квадрат.
    expect(await accent()).toBe('rgb(47, 91, 255)'); // --accent светлой #2F5BFF

    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
    await page.reload();
    expect(await accent()).toBe('rgb(91, 132, 255)'); // --accent тёмной #5B84FF
    await ctx.close();
  });

  test('цвет полосы браузера объявлен и следует выбранной теме', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await page.goto('/');

    const declared = () =>
      page.locator('meta[name="theme-color"]').evaluateAll((metas) =>
        metas.map((m) => ({
          media: m.getAttribute('media') ?? '',
          content: (m.getAttribute('content') ?? '').toUpperCase(),
        })),
      );

    // Без этого браузер на телефоне оставляет свою верхнюю полосу светлой над
    // тёмной страницей — светлая рамка вокруг #0E1420.
    const initial = await declared();
    expect(initial.length, 'theme-color не объявлен').toBeGreaterThanOrEqual(2);
    expect(initial.find((m) => m.media.includes('dark'))?.content).toBe('#0E1420');
    expect(initial.find((m) => m.media.includes('light'))?.content).toBe('#F4F6F9');

    // Выбор пользователя перекрывает системную схему — вместе с полосой браузера.
    await page.getByRole('button', { name: /тема/i }).click(); // тёмная -> светлая
    await expect
      .poll(async () => (await declared()).every((m) => m.content === '#F4F6F9'), {
        message: 'выбор светлой темы не доехал до полосы браузера',
      })
      .toBe(true);

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

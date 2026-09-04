/* Порт берётся из baseURL конфига, а не зашит числом: с 2026-08-13 по
   репозиторию работают параллельные git-worktree, у каждой копии свой порт
   (`SITE_PORT`). Зашитый 4321 делал этот тест красным в любой копии, кроме
   основной, — то есть проверка ломалась не от кода, а от места запуска. */
import { test, expect } from '@playwright/test';

/* Английская главная и переключатель языка вернулись 2026-08-22 по задаче
 * владельца «локализовать весь текст главной под английский язык». Условие
 * приёмки его словами: «кнопка сменить язык успешно меняет язык, и весь
 * контент на странице остаётся на местах, но уже переведён».
 *
 * Здесь проверяется ПЕРВАЯ половина условия — что кнопка работает и приводит
 * туда, куда обещает, в обе стороны и с любой страницы. Вторая половина
 * («контент на местах») проверяется на собранной разметке, без браузера:
 * `tests/dist-en-parity.test.ts` сравнивает структуру двух версий элемент в
 * элемент.
 *
 * С 2026-08-21 по 2026-08-22 здесь стояло обратное: маршрут `/en` и
 * переключатель были сняты правкой владельца (D-078), и тесты подтверждали
 * снятие. */

test('маршрут /en существует и отдаёт английскую страницу', async ({ page }) => {
  const response = await page.goto('/en');
  expect(response?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('переключатель есть на каждой странице сайта', async ({ page }) => {
  for (const path of ['/', '/en', '/contact', '/privacy', '/terms', '/consent', '/thanks']) {
    await page.goto(path);
    await expect(page.locator('a.lang'), `${path}: переключателя нет`).toHaveCount(1);
  }
});

test('нажатие меняет язык страницы и возвращает обратно', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');

  // Подпись кнопки — код ЦЕЛЕВОГО языка: кнопка называет, куда ведёт.
  const toEn = page.locator('a.lang');
  await expect(toEn).toHaveText('EN');
  await toEn.click();

  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  const toRu = page.locator('a.lang');
  await expect(toRu).toHaveText('RU');
  await toRu.click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
});

/* Молча вести на 404 запрещено (спека `01-foundation.md`, раздел 7). У
   одноязычных страниц английской пары нет, и переключатель обязан вести на
   английскую ГЛАВНУЮ, объясняя это подписью, а не притворяться, что перевод
   страницы существует. */
test('с одноязычной страницы переключатель ведёт на главную и говорит об этом',
  async ({ page }) => {
    for (const path of ['/contact', '/privacy', '/thanks']) {
      await page.goto(path);
      const link = page.locator('a.lang');
      await expect(link, `${path}`).toHaveAttribute('href', '/en');
      // Пояснение написано на языке СТРАНИЦЫ, а не цели: его читает тот, кто
      // сейчас на этой странице, то есть по-русски. Подпись самой кнопки —
      // наоборот, код целевого языка.
      await expect(link, `${path}: нет пояснения`)
        .toHaveAttribute('title', 'Этой страницы нет на английском — откроется главная');
    }
  });

test('переключатель объявляет язык цели, а не молчит о нём', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('a.lang');
  await expect(link).toHaveAttribute('hreflang', 'en');
  await expect(link).toHaveAttribute('lang', 'en');

  await page.goto('/en');
  const back = page.locator('a.lang');
  await expect(back).toHaveAttribute('hreflang', 'ru');
  await expect(back).toHaveAttribute('lang', 'ru');
});

/* Пункты английской шапки ведут на якоря СВОЕЙ страницы. Пункт, ведущий на
   `/#services`, менял бы язык нажатием на меню — беззвучно и правдоподобно. */
test('пункты английской шапки не уводят на русскую версию', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en');
  const hrefs = await page.locator('header nav.nav-wide a')
    .evaluateAll((links) => links.map((l) => l.getAttribute('href') ?? ''));
  expect(hrefs.length).toBe(6);
  for (const href of hrefs) {
    expect(href, `${href} уводит с английской версии`).toMatch(/^\/en#[a-z-]+$/);
  }
});

test('ни одна ссылка каркаса не указывает на несуществующее место страницы',
  async ({ page }) => {
    for (const start of ['/', '/en', '/contact']) {
      await page.goto(start);
      const hrefs = await page.locator('header a[href], footer a[href]')
        .evaluateAll((links) => links.map((l) => l.getAttribute('href') ?? ''));

      for (const href of hrefs.filter((h) => h.includes('#'))) {
        const [base, hash] = href.split('#');
        if (!hash) continue;
        const target = base.replace(/(.)\/$/, '$1') || start;
        await page.goto(target);
        await expect(
          page.locator(`#${hash}`),
          `${href} со страницы ${start}: якоря нет на ${target}`,
        ).toHaveCount(1);
        await page.goto(start);
      }
    }
  });

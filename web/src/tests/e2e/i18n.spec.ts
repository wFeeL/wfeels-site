/* Порт берётся из baseURL конфига, а не зашит числом: с 2026-08-13 по
   репозиторию работают параллельные git-worktree, у каждой копии свой порт
   (`SITE_PORT`). Зашитый 4321 делал этот тест красным в любой копии, кроме
   основной, — то есть проверка ломалась не от кода, а от места запуска. */
import { test, expect } from '@playwright/test';

/* Правка владельца 2026-08-21, дословно: «убираем переключатель на
 * английский язык страницы. можем также полностью пока убрать путь /en».
 * Слово «пока» и решило глубину (D-078): снята видимая поверхность —
 * маршрут `/en` и компонент `LangSwitch`, — а механика двуязычия (`en.ts`,
 * `dict()`, `localeFromPath`, `stripLocale`, проп `lang`) осталась нетронутой
 * ради дешёвого возврата.
 *
 * До этой правки здесь стоял полный набор тестов маршрута `/en` и
 * переключателя — отдаваемый `lang`, работающий переход туда-обратно, пустая
 * шапка английской версии, английский подвал, переключатель на одноязычной
 * странице. Все они проверяли то, что снято; ниже — только то, что
 * подтверждает снятие. */

test('маршрута /en больше нет', async ({ page }) => {
  const response = await page.goto('/en');
  expect(response?.status()).toBe(404);
});

test('переключателя языка нет ни на одной странице', async ({ page }) => {
  for (const path of ['/', '/contact', '/privacy', '/terms', '/consent', '/thanks']) {
    await page.goto(path);
    await expect(page.locator('a.lang')).toHaveCount(0);
  }
});

test('ни одна ссылка каркаса не указывает на несуществующее место страницы',
  async ({ page }) => {
    for (const start of ['/', '/contact']) {
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

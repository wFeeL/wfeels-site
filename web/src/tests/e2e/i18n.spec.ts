/* Порт берётся из baseURL конфига, а не зашит числом: с 2026-08-13 по
   репозиторию работают параллельные git-worktree, у каждой копии свой порт
   (`SITE_PORT`). Зашитый 4321 делал этот тест красным в любой копии, кроме
   основной, — то есть проверка ломалась не от кода, а от места запуска. */
import { test, expect } from '@playwright/test';

test('английская главная отдаётся с правильным lang', async ({ page }) => {
  await page.goto('/en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toHaveText('wfeels');
});

test('переключатель ведёт с русской главной на английскую и обратно',
  async ({ page, baseURL }) => {
    await page.goto('/');
    await page.locator('a.lang').click();
    await expect(page).toHaveURL(/\/en$/);
    await page.locator('a.lang').click();
    await expect(page).toHaveURL(new RegExp(`^${baseURL}/$`));
  });

test('в английской шапке нет пунктов, которым некуда вести', async ({ page }) => {
  await page.goto('/en');
  // Английских разделов ещё нет (спека 02). Пять пунктов вели на секции
  // `/en/#services` и подобные, которых на странице не существует: нажатие не
  // делало ничего — ни перехода, ни прокрутки, ни честной 404.
  await expect(page.locator('header nav.nav-wide a')).toHaveCount(0);
  await expect(page.locator('header details.nav-narrow')).toHaveCount(0);
  // Уйти со страницы всё равно есть куда: знак бренда, переключатель языка и
  // кнопка обращения.
  await expect(page.locator('header a.brand')).toHaveCount(1);
  await expect(page.locator('header a.lang')).toHaveCount(1);
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

test('подвал английской страницы английский целиком', async ({ page }) => {
  await page.goto('/en');
  const text = await page.locator('footer').innerText();
  // Правка владельца 2026-08-21 сняла группу «Юридические документы» из
  // подвала целиком (навигация ушла, страницы остались построенными) —
  // проверки её английского заголовка здесь больше нет: проверять нечего.
  expect(text, `в английском подвале осталась кириллица:\n${text}`)
    .not.toMatch(/[А-Яа-яЁё]/);
  await expect(page.locator('footer a[href="/privacy"]')).toHaveCount(0);
});

test('с одноязычной страницы переключатель ведёт на английскую главную, а не в 404',
  async ({ page }) => {
    await page.goto('/privacy');
    const link = page.locator('a.lang');
    await expect(link).toHaveAttribute('href', '/en');
    await expect(link).toHaveAttribute('title', /нет на английском/);
  });

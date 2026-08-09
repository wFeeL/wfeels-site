import { test, expect } from '@playwright/test';

test('английская главная отдаётся с правильным lang', async ({ page }) => {
  await page.goto('/en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toHaveText('wfeels');
});

test('переключатель ведёт с русской главной на английскую и обратно',
  async ({ page }) => {
    await page.goto('/');
    await page.locator('a.lang').click();
    await expect(page).toHaveURL(/\/en$/);
    await page.locator('a.lang').click();
    await expect(page).toHaveURL(/localhost:4321\/$/);
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
  // Юридические страницы остаются русскими — это нормально, документ русский.
  // Но их заголовки в подвале обязаны быть на языке страницы.
  expect(text, `в английском подвале осталась кириллица:\n${text}`)
    .not.toMatch(/[А-Яа-яЁё]/);
  await expect(page.locator('footer a[href="/privacy"]')).toHaveText(/privacy/i);
});

test('с одноязычной страницы переключатель ведёт на английскую главную, а не в 404',
  async ({ page }) => {
    await page.goto('/privacy');
    const link = page.locator('a.lang');
    await expect(link).toHaveAttribute('href', '/en');
    await expect(link).toHaveAttribute('title', /нет на английском/);
  });

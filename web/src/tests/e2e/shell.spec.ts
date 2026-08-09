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

test('текущая страница отмечена в навигации', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/kontakt');

  const current = page.locator('header nav.nav-wide a[aria-current="page"]');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText('Контакты');

  // На главной пункта «Главная» в навигации нет — отмечать нечего, и лишней
  // отметки быть не должно.
  await page.goto('/');
  await expect(page.locator('header nav.nav-wide a[aria-current="page"]'))
    .toHaveCount(0);
});

/* Четыре теста ниже держат то, что до правки было написано в стилях шапки и
   не применялось ни разу: правила `nav a` жили в Header.astro, а сами ссылки
   рисует NavLinks.astro, и атрибут скоупа у них разный. Разметка была верной,
   поведение — отсутствовало, и ни один тест этого не видел, потому что все
   проверяли текст и атрибуты, а не отрисовку. */

test('пункт навигации отвечает на курсор и приглушён в покое', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const link = page.locator('header nav.nav-wide a').first();
  const color = () => link.evaluate((el) => getComputedStyle(el).color);

  const idle = await color();
  // Знак бренда набран основным цветом. Если навигация в покое такая же —
  // иерархии «знак → навигация → кнопка» на экране нет.
  const brand = await page.locator('header .brand')
    .evaluate((el) => getComputedStyle(el).color);
  expect(idle, 'пункт меню не приглушён относительно знака').not.toBe(brand);

  await link.hover();
  await expect.poll(color, { message: 'цвет не изменился под курсором' })
    .not.toBe(idle);
});

test('текущий пункт отличается от остальных не только атрибутом', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/kontakt');

  const read = (selector: string) =>
    page.locator(selector).first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { color: s.color, weight: s.fontWeight, deco: s.textDecorationLine };
    });

  const current = await read('header nav.nav-wide a[aria-current="page"]');
  const other = await read('header nav.nav-wide a:not([aria-current])');

  expect(current.color, 'цвет текущего пункта такой же').not.toBe(other.color);
  expect(current.weight, 'насыщенность текущего пункта такая же').not.toBe(other.weight);
});

test('пункт мобильного меню — цель для пальца, а не строка в 26 px',
  async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');

    const menu = page.locator('header details.nav-narrow');
    await menu.locator('summary').click();
    const links = menu.locator('a');
    await expect(links).toHaveCount(5);

    for (const link of await links.all()) {
      const box = await link.boundingBox();
      const text = await link.innerText();
      expect(box, `пункт «${text}» не отрисован`).not.toBeNull();
      expect(box!.height, `высота пункта «${text}»`).toBeGreaterThanOrEqual(44);
    }
  });

test('высота шапки одинакова на всех страницах одного языка', async ({ page }) => {
  for (const size of [{ width: 1280, height: 900 }, { width: 375, height: 800 }]) {
    await page.setViewportSize(size);
    const heights: Record<string, number> = {};
    for (const path of ['/', '/kontakt', '/politika', '/spasibo']) {
      await page.goto(path);
      heights[path] = await page.locator('header')
        .evaluate((el) => el.getBoundingClientRect().height);
    }
    // Полоса прогресса есть не везде. Пока она была последним потомком шапки,
    // её 2 px шли в высоту, и при каждом уходе с главной содержимое опускалось.
    expect(
      new Set(Object.values(heights)).size,
      `${size.width} px: ${JSON.stringify(heights)}`,
    ).toBe(1);
  }
});

test('переключатели стоят на одном месте на всех страницах', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const left = async (path: string) => {
    await page.goto(path);
    return (await page.locator('header #theme-toggle').boundingBox())!.x;
  };

  // Кнопка «Написать» намеренно снята на /kontakt и /spasibo. Место под неё
  // обязано остаться: шапка липкая, и без резерва два круглых переключателя
  // проезжали через треть экрана при каждом переходе.
  const home = await left('/');
  expect(await left('/kontakt'), 'переключатели уехали на /kontakt').toBe(home);
  expect(await left('/spasibo'), 'переключатели уехали на /spasibo').toBe(home);
});

test('ссылки подвала видно как ссылки', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('footer nav a').first();
  const s = await link.evaluate((el) => {
    const c = getComputedStyle(el);
    return { color: c.color, deco: c.textDecorationLine };
  });
  const text = await page.locator('footer .ai')
    .evaluate((el) => getComputedStyle(el).color);

  expect(s.color, 'ссылка подвала того же цвета, что текст рядом').not.toBe(text);
  expect(s.deco, 'ссылка подвала без подчёркивания').toContain('underline');
});

test('в подвале есть юридические ссылки и строка про ИИ', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer a[href="/politika"]')).toBeVisible();
  await expect(page.locator('footer a[href="/oferta"]')).toBeVisible();
  await expect(page.locator('footer a[href="/soglasie"]')).toBeVisible();
  await expect(page.locator('footer')).toContainText('вместе с ИИ');
});

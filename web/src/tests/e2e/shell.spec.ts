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
  await page.goto('/contact');

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

test('под курсором у пункта появляется та же черта, что у текущей страницы',
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/contact');

    const style = (selector: string) =>
      page.locator(selector).first().evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          color: s.color,
          weight: s.fontWeight,
          line: s.textDecorationLine,
          decoColor: s.textDecorationColor,
          thickness: s.textDecorationThickness,
        };
      });

    const current = await style('header nav.nav-wide a[aria-current="page"]');
    const other = 'header nav.nav-wide a:not([aria-current])';
    const idle = await style(other);

    // До правки наведение меняло только цвет. Владелец просил ту же черту.
    expect(idle.line, 'в покое пункт подчёркнут — черта перестала что-то значить')
      .not.toContain('underline');

    await page.locator(other).first().hover();
    const hovered = await style(other);
    expect(hovered.line, 'под курсором черты нет').toContain('underline');
    expect(hovered.decoColor, 'черта под курсором не акцентная')
      .toBe(current.decoColor);
    expect(hovered.thickness, 'черта под курсором другой толщины')
      .toBe(current.thickness);

    // Черта теперь есть у обоих, поэтому отметка текущей страницы обязана
    // держаться на чём-то ещё. Держится на двух: цвете и насыщенности.
    expect(current.color, 'наведённый пункт не отличить от текущего по цвету')
      .not.toBe(hovered.color);
    expect(current.weight, 'наведённый пункт не отличить от текущего по насыщенности')
      .not.toBe(hovered.weight);
  });

/** Середина видимого ТЕКСТА, а не коробки вокруг него. Разница здесь и есть
 *  предмет проверки: общее правило `min-height: 44px` растит коробку, а текст
 *  в блоке ложится по её верху. */
async function textMiddle(scope: import('@playwright/test').Locator) {
  return scope.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    return (r.top + r.bottom) / 2;
  });
}

async function boxMiddle(scope: import('@playwright/test').Locator) {
  return scope.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return (r.top + r.bottom) / 2;
  });
}

test('текст в шапке стоит по центру своей цели нажатия', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  // Замер до правки: шапка 64 px, коробки всех трёх групп по 44 px и
  // отцентрованы верно, а строка знака бренда (17 px) и строка пункта меню
  // (24,75 px) стояли по ВЕРХУ своих коробок — текст занимал верхнюю треть
  // цели нажатия, снизу оставалась пустота.
  const bar = await boxMiddle(page.locator('header .bar'));

  const parts = {
    'знак бренда': 'header .brand',
    'пункт навигации': 'header nav.nav-wide a',
    'переключатель языка': 'header a.lang',
    'кнопка обращения': 'header .btn',
  };
  for (const [name, selector] of Object.entries(parts)) {
    const middle = await textMiddle(page.locator(selector).first());
    expect(
      Math.abs(middle - bar),
      `${name}: середина текста разошлась с серединой шапки`,
    ).toBeLessThanOrEqual(2);
  }
});

test('текст органов управления стоит по центру и там, где шапка узкая',
  async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');

    // Раскрывашка мобильного меню — тот же `min-height: 44px` из base.css,
    // только на `summary`.
    const summary = page.locator('header details.nav-narrow summary');
    expect(
      Math.abs((await textMiddle(summary)) - (await boxMiddle(summary))),
      'слово «Меню» прижато к краю своей цели нажатия',
    ).toBeLessThanOrEqual(2);

    await summary.click();
    const link = page.locator('header details.nav-narrow a').first();
    expect(
      Math.abs((await textMiddle(link)) - (await boxMiddle(link))),
      'пункт мобильного меню прижат к краю своей цели нажатия',
    ).toBeLessThanOrEqual(2);
  });

test('в подвале текст ссылок тоже стоит по центру цели нажатия', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('footer nav a').first();
  expect(
    Math.abs((await textMiddle(link)) - (await boxMiddle(link))),
    'ссылка подвала прижата к верху своей цели нажатия',
  ).toBeLessThanOrEqual(2);
});

test('текущий пункт отличается от остальных не только атрибутом', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/contact');

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
    for (const path of ['/', '/contact', '/privacy', '/thanks']) {
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

  // Кнопка «Написать» намеренно снята на /contact и /thanks. Место под неё
  // обязано остаться: шапка липкая, и без резерва два круглых переключателя
  // проезжали через треть экрана при каждом переходе.
  const home = await left('/');
  expect(await left('/contact'), 'переключатели уехали на /contact').toBe(home);
  expect(await left('/thanks'), 'переключатели уехали на /thanks').toBe(home);
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

/* Две жалобы владельца — «на главной сверху мало, на контактах много» — это одна
   причина: главная клала метку и заголовок прямо в контейнер, мимо `Section`, и
   не получала верхнего отступа вовсе, а `/contact` получала полные 96 px и
   уводила заголовок вниз. */
test('первая секция страницы отбита от шапки меньше, чем секции друг от друга',
  async ({ page }) => {
    for (const size of [{ width: 1280, height: 900 }, { width: 375, height: 800 }]) {
      await page.setViewportSize(size);
      for (const path of ['/', '/en', '/contact', '/privacy', '/thanks']) {
        await page.goto(path);
        const pad = await page.locator('main section').first().evaluate((el) => {
          const s = getComputedStyle(el);
          return { top: parseFloat(s.paddingTop), bottom: parseFloat(s.paddingBottom) };
        });
        const where = `${path} на ${size.width} px`;
        expect(pad.top, `${where}: первая секция без верхнего отступа`)
          .toBeGreaterThan(0);
        expect(pad.top, `${where}: первая секция отбита как рядовая`)
          .toBeLessThan(pad.bottom);
      }
    }
  });

test('заголовок первой страницы начинается близко к шапке', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const path of ['/', '/contact']) {
    await page.goto(path);
    const gap = await page.evaluate(() => {
      const header = document.querySelector('header')!.getBoundingClientRect();
      const first = document.querySelector('main section')!.firstElementChild!;
      return first.getBoundingClientRect().top - header.bottom;
    });
    expect(gap, `${path}: первый экран пустует сверху`).toBeLessThanOrEqual(56);
    expect(gap, `${path}: содержимое липнет к шапке`).toBeGreaterThanOrEqual(16);
  }
});

test('в подвале есть юридические ссылки и строка про ИИ', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('footer a[href="/privacy"]')).toBeVisible();
  await expect(page.locator('footer a[href="/terms"]')).toBeVisible();
  await expect(page.locator('footer a[href="/consent"]')).toBeVisible();
  await expect(page.locator('footer')).toContainText('вместе с ИИ');
});

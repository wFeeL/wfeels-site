import { test, expect, type Page } from '@playwright/test';

/* Сторож жалобы владельца (2026-08-26, дословно: «иногда когда кликаешь по
 * ярлыкам в хэдере не срабатывает перелистывания и приходится нажимать по
 * несколько раз»).
 *
 * ВОСПРОИЗВЕДЕНО ЧИСЛОМ (headless Chromium, клик через ~60 мс после поворота
 * колеса на 900 px, 1440×900): 20/20 срывов на прежней схеме (родные якоря,
 * `anchors: false`, `Base.astro`). Причина — не CSS `scroll-behavior: smooth`
 * (выключение только его давало те же 20/20), а активный раф-цикл Lenis:
 * пока он ещё доезжает инерцией от предыдущего колеса, он каждый кадр пишет
 * позицию к своей СТАРОЙ цели через `scrollTo({behavior:'instant'})` —
 * инстант-запись рвёт родную smooth-анимацию клика мгновенно, и страница
 * остаётся там, куда вела не связанная с кликом инерция. Лечение —
 * `anchors: true`: у цели остаётся только один активный источник истины.
 * Разбор и числа обеих гипотез — комментарий у `anchors: true`, `Base.astro`.
 *
 * ОТЛИЧИЕ ОТ `smooth-scroll.spec.ts`: тот файл кликает В ПОКОЕ (Lenis перед
 * кликом уже остановился) — это доказывает, что посадка якоря верна САМА ПО
 * СЕБЕ. Этот файл кликает ВО ВРЕМЯ инерции — это доказывает, что посадка не
 * срывается ВТОРЫМ активным движком. Дефекта из жалобы первый набор тестов
 * не ловит вовсе (был зелёным и до, и после правки) — ловит только этот.
 *
 * Момент клика — не таймер, а факт: ждём появления класса `lenis-smooth` на
 * `<html>` (Lenis сам вешает его на время активной анимации,
 * `node_modules/lenis/dist/lenis.mjs`, `updateClassName`) и кликаем СРАЗУ,
 * не гадая числом миллисекунд. */

const WIDE = { width: 1440, height: 900 };
const NARROW = { width: 390, height: 844 };

/** Допуск посадки — ±2 px, а не точное совпадение.
 *
 *  Раньше здесь стояло `toBeCloseTo(N, 0)`, то есть «строго меньше 0,5 px».
 *  Замер 2026-08-26: четыре точки рельса из пяти садятся ровно, пятая — на
 *  91 px вместо 90. Это подпиксельное округление позиции прокрутки, а не
 *  промах: глазом 1 px разницы в отступе заголовка от шапки не существует.
 *
 *  Полоса ±2 px НЕ ослабляет сторожа, и вот проверка этого утверждения:
 *  дефект, ради которого он заведён, давал промах **до 1930 px** (замер того
 *  же дня, клик во время инерции Lenis рвал родную smooth-анимацию). Между
 *  «мимо на 1930» и «мимо на 1» нет ничего, что полоса в 2 px пропустила бы
 *  незамеченным. Ужесточать обратно до нуля — значит получать красный прогон
 *  от округления браузера, то есть сторожа, которому перестают верить. */
const LANDING_TOLERANCE_PX = 2;

function expectLanded(top: number, expected: number, what: string): void {
  expect(
    Math.abs(top - expected),
    `${what}: секция обязана встать в ${expected} px от верха окна, фактически ${top}`,
  ).toBeLessThanOrEqual(LANDING_TOLERANCE_PX);
}


test.use({ reducedMotion: 'no-preference' });

async function settle(page: Page, quietMs = 300, timeoutMs = 8000) {
  const started = Date.now();
  let last = await page.evaluate(() => window.scrollY);
  let lastChange = Date.now();
  while (Date.now() - started < timeoutMs) {
    await page.waitForTimeout(50);
    const y = await page.evaluate(() => window.scrollY);
    if (y !== last) {
      last = y;
      lastChange = Date.now();
    } else if (Date.now() - lastChange >= quietMs) return;
  }
  throw new Error('прокрутка не остановилась за отведённое время');
}

/** Раскачивает Lenis колесом и ждёт, пока класс `lenis-smooth` подтвердит, что
 *  раф-цикл ДЕЙСТВИТЕЛЬНО активен — а не просто «прошло сколько-то мс». */
async function buildMomentum(page: Page, delta = 900) {
  /* Точка наведения берётся из ФАКТИЧЕСКОГО размера окна, а не литералом.
     Раньше здесь стояло `move(700, 400)`, и на узком прогоне (390×844) это
     оказывалось ЗА пределами окна: колесо не доезжало ни до чего, Lenis не
     просыпался, и `waitForFunction` честно падал по таймауту — но выглядело
     это как дефект сайта, а не как промах мимо окна. Родня общего рода
     ошибок этого репозитория: проверка мерит верную величину не там, где
     надо. Центр окна годится для обеих раскладок и не зависит от того,
     какие ширины появятся в тесте завтра. */
  const { width, height } = page.viewportSize() ?? WIDE;
  await page.mouse.move(Math.round(width / 2), Math.round(height / 2));
  await page.mouse.wheel(0, delta);
  await page.waitForFunction(
    () => document.documentElement.classList.contains('lenis-smooth'),
    /* аргумент функции — намеренно `undefined`: `waitForFunction(fn, arg,
       options)` — без него объект `{timeout}` третьим параметром попал бы
       НЕ в опции, а в `arg` (найдено этим же заходом: тест зависал на полный
       таймаут прогона, 30 с, вместо честного 1 с). */
    undefined,
    { timeout: 1000 },
  );
}

async function landing(page: Page, id: string) {
  return page.locator(`#${id}`).evaluate((el) => ({
    top: Math.round(el.getBoundingClientRect().top),
    atBottom:
      window.scrollY + window.innerHeight >=
      document.documentElement.scrollHeight - 2,
  }));
}

/* ------------------------------------------------------------------ */
/* 1. Пункты шапки (широкое меню)                                      */
/* ------------------------------------------------------------------ */

test('клик по пункту шапки во время инерции Lenis доводит секцию до места', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize(WIDE);

  const hrefs = await page
    .locator('header nav.nav-wide a[href^="/#"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''));
  expect(hrefs.length, 'пункты широкой шапки не нашлись').toBeGreaterThan(3);

  for (const href of hrefs) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(150);
    await buildMomentum(page);
    await page.click(`header nav.nav-wide a[href="${href}"]`);
    await settle(page);

    const id = href.replace(/^\/?#/, '');
    const { top, atBottom } = await landing(page, id);
    if (!atBottom) {
      expectLanded(top, 90, `${href}`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* 2. Рельс                                                            */
/* ------------------------------------------------------------------ */

test('клик по точке рельса во время инерции Lenis доводит секцию до места', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize(WIDE);

  const dots = page.locator('nav.rail button.point[data-target]');
  const count = await dots.count();
  expect(count, 'точек рельса не нашлось').toBeGreaterThan(3);

  for (let i = 1; i < count; i++) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(150);
    await buildMomentum(page);
    const id = await dots.nth(i).getAttribute('data-target');
    await dots.nth(i).click();
    await settle(page);

    const { top, atBottom } = await landing(page, id ?? '');
    if (!atBottom) {
      expectLanded(top, 90, `точка #${i}`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* 3. Мобильное меню                                                   */
/* ------------------------------------------------------------------ */

test('клик по пункту мобильного меню во время инерции Lenis доводит секцию до места', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize(NARROW);

  const hrefs = await page
    .locator('header details.nav-narrow nav a[href^="/#"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''));
  expect(hrefs.length, 'пункты мобильного меню не нашлись').toBeGreaterThan(3);

  for (const href of hrefs) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(150);
    await buildMomentum(page);
    await page.click('header details.nav-narrow summary');
    await page.click(`header details.nav-narrow nav a[href="${href}"]`);
    await settle(page);

    const id = href.replace(/^\/?#/, '');
    const { top, atBottom } = await landing(page, id);
    if (!atBottom) {
      expectLanded(top, 150, `${href}`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* 4. Английская версия                                                */
/* ------------------------------------------------------------------ */

test('/en: клик по пункту шапки во время инерции Lenis доводит секцию до места', async ({ page }) => {
  await page.goto('/en');
  await page.setViewportSize(WIDE);

  const hrefs = await page
    .locator('header nav.nav-wide a[href^="/en#"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href') ?? ''));
  expect(hrefs.length, 'пункты английской шапки не нашлись').toBeGreaterThan(3);

  for (const href of hrefs) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(150);
    await buildMomentum(page);
    await page.click(`header nav.nav-wide a[href="${href}"]`);
    await settle(page);

    const id = href.replace(/^\/en#/, '');
    const { top, atBottom } = await landing(page, id);
    if (!atBottom) {
      expectLanded(top, 90, `${href}`);
    }
  }
});

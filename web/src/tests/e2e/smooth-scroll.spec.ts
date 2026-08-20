import { test, expect, type Page } from '@playwright/test';

/* Сторож плавной прокрутки (Lenis, `layouts/Base.astro`, правка владельца
 * 2026-08-20).
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ НАБОР. Безголовый Chromium сам просит `prefers-reduced-
 * motion: reduce` — это уже записано в шапках соседних сторожей
 * (`about-photo.spec.ts`). При `reduce` экземпляр Lenis не создаётся вовсе,
 * то есть ВЕСЬ остальной набор e2e проходит по НЕплавному пути и о плавной
 * прокрутке не доказывает ничего. Здесь стоит явный `no-preference`, и
 * только здесь код правки вообще исполняется.
 *
 * ЧТО ДОКАЗЫВАЕТСЯ.
 *   1. Плавность действительно включилась: позиция после одного поворота
 *      колеса меняется не за кадр, а за несколько.
 *   2. Родные таймлайны прокрутки (`animation-timeline: view()` — линия на
 *      фоне, «Замер», ряды «Как я работаю») при плавной прокрутке дают тот же
 *      прогресс, что и при обычной, на одних и тех же положениях. Это главный
 *      риск правки: разъедься они — поехало бы всё сразу и молча.
 *   3. Переходы по якорям, рельс и полоса прогресса живы на плавном пути.
 *   4. При `reduce` плавности нет и в помине.
 */

const WIDE = { width: 1440, height: 900 };

/** Все тесты файла, кроме явно помеченного блока про `reduce`. */
test.use({ reducedMotion: 'no-preference', viewport: WIDE });

type Sample = [t: number, y: number];

declare global {
  interface Window {
    __samples?: Sample[];
    __wheelAt?: number;
  }
}

/** Снимает позицию прокрутки покадрово вокруг одного поворота колеса.
 *  Возвращает отсчёты, отсчитанные от МОМЕНТА СОБЫТИЯ КОЛЕСА, а не от начала
 *  замера: между запуском сборщика и доставкой события проходит несколько
 *  миллисекунд, и без этой поправки «время до остановки» завышалось бы. */
async function wheelTrace(
  page: Page,
  delta: number,
  ms = 1500,
): Promise<{ y0: number; trace: Sample[] }> {
  const y0 = await page.evaluate(() => window.scrollY);
  await page.evaluate((limit) => {
    window.__samples = [];
    window.__wheelAt = undefined;
    const start = performance.now();
    // Слушатель в фазе перехвата: Lenis гасит событие по умолчанию, но до
    // своего обработчика на window добраться нам это не мешает.
    window.addEventListener(
      'wheel',
      () => {
        if (window.__wheelAt === undefined) window.__wheelAt = performance.now() - start;
      },
      { capture: true, passive: true, once: true },
    );
    const tick = () => {
      const t = performance.now() - start;
      window.__samples!.push([t, window.scrollY]);
      if (t < limit) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, ms);

  await page.mouse.wheel(0, delta);
  await page.waitForTimeout(ms + 120);

  const trace = await page.evaluate(() => {
    const at = window.__wheelAt ?? 0;
    return (window.__samples ?? [])
      .filter(([t]) => t >= at)
      .map(([t, y]) => [Math.round((t - at) * 10) / 10, y] as Sample);
  });
  return { y0, trace };
}

/** Число кадров, на которых позиция изменилась, и время выхода на конечное
 *  значение. Оба числа и отличают плавную прокрутку от мгновенной. */
function traceStats(y0: number, trace: Sample[]) {
  /* Отсчёт идёт от позиции ДО события колеса, а не от первого снятого кадра:
     первый же кадр после колеса у плавной прокрутки уже сдвинут (при
     `lerp: 0.12` — на 11% пути), и замер «от первого кадра» занижал бы
     пройденное ровно на этот шаг. Ошибка была в первой редакции теста: он
     показывал 532 px вместо 600 и выглядел как дефект кода. */
  const first = y0;
  const last = trace[trace.length - 1]?.[1] ?? 0;
  let moving = 0;
  let settleAt = 0;
  let prev = y0;
  for (let i = 0; i < trace.length; i++) {
    if (trace[i][1] !== prev) {
      moving++;
      settleAt = trace[i][0];
      prev = trace[i][1];
    }
  }
  return { first, last, travelled: last - first, movingFrames: moving, settleAt };
}

/* ------------------------------------------------------------------ */
/* 1. Плавность включилась                                             */
/* ------------------------------------------------------------------ */

test('плавность включена: один поворот колеса едет несколько кадров', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/(^|\s)lenis(\s|$)/);

  const { y0, trace } = await wheelTrace(page, 600);
  const s = traceStats(y0, trace);
  const firstFrame = trace[0]?.[1] ?? 0;

  console.log(
    `[плавность] пройдено ${s.travelled} px, кадров с движением ${s.movingFrames}, ` +
      `остановка на ${s.settleAt} мс, за первый кадр ${firstFrame - s.first} px`,
  );

  expect(s.travelled, 'колесо на 600 px обязано довезти ровно на 600 px').toBeCloseTo(600, 0);
  expect(s.movingFrames, 'мгновенный скачок — это один кадр с движением').toBeGreaterThan(8);
  expect(s.settleAt, 'страница не должна тянуться дольше секунды').toBeLessThan(1000);
  expect(s.settleAt, 'меньше 100 мс — это уже не плавность, а дрожь').toBeGreaterThan(100);
  expect(
    firstFrame - s.first,
    'за первый кадр обязана пройти малая часть пути, иначе это скачок',
  ).toBeLessThan(200);
});

/* ------------------------------------------------------------------ */
/* 2. Родные таймлайны не разъехались                                  */
/* ------------------------------------------------------------------ */

/** Три анимации из трёх разных мест страницы. Ключ — селектор корня, прогресс
 *  снимается со всего поддерева: `.reveal`-рядов в секции пять, у линии на
 *  фоне свой набор боксов. */
const TIMELINE_ROOTS: Record<string, string> = {
  'линия на фоне': 'svg.line',
  'иллюстрация «Замер»': '[data-illustration="case-weight"]',
  'ряды «Как я работаю»': '#process',
};

/** Прогресс всех анимаций поддерева, привязанных к таймлайну прокрутки
 *  (`a.timeline !== document.timeline`). Порядок стабилен — порядок разметки. */
async function timelineProgress(page: Page, root: string): Promise<number[]> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return [];
    return el
      .getAnimations({ subtree: true })
      .filter((a) => a.timeline !== null && a.timeline !== document.timeline)
      .map((a) => {
        const p = a.effect?.getComputedTiming().progress;
        return typeof p === 'number' ? Math.round(p * 1e4) / 1e4 : -1;
      });
  }, root);
}

test('родные таймлайны при плавной прокрутке идут в ногу с обычной', async ({ page }) => {
  await page.goto('/');

  const positions = await page.evaluate(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    // Восемь положений по всей длине страницы: каждая из трёх анимаций
    // попадает и в свой диапазон, и за него.
    return Array.from({ length: 8 }, (_, i) => Math.round((max * (i + 1)) / 9));
  });

  // Ход первый — ОБЫЧНАЯ прокрутка: позиция ставится родным `scrollTo`,
  // Lenis при этом простаивает и лишь подтягивает свою внутреннюю позицию.
  const native: Record<string, number[][]> = {};
  for (const [label, sel] of Object.entries(TIMELINE_ROOTS)) native[label] = [];
  for (const y of positions) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
    await page.waitForTimeout(120);
    for (const [label, sel] of Object.entries(TIMELINE_ROOTS)) {
      native[label].push(await timelineProgress(page, sel));
    }
  }

  // Ход второй — ПЛАВНАЯ: в те же положения приезжаем колесом, ждём
  // фактической остановки и только тогда снимаем прогресс.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(200);

  const smooth: Record<string, number[][]> = {};
  for (const label of Object.keys(TIMELINE_ROOTS)) smooth[label] = [];
  for (const y of positions) {
    const from = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, y - from);
    await page.waitForFunction(
      (target) => Math.abs(window.scrollY - target) < 1,
      y,
      { timeout: 4000 },
    );
    await page.waitForTimeout(150);
    for (const [label, sel] of Object.entries(TIMELINE_ROOTS)) {
      smooth[label].push(await timelineProgress(page, sel));
    }
  }

  const report: string[] = [];
  let worst = 0;
  let worstWhere = '—';
  for (const label of Object.keys(TIMELINE_ROOTS)) {
    let countedFrames = 0;
    for (let i = 0; i < positions.length; i++) {
      const a = native[label][i];
      const b = smooth[label][i];
      expect(
        b.length,
        `${label}: на позиции ${positions[i]} px число анимаций разошлось ` +
          `(обычная ${a.length}, плавная ${b.length})`,
      ).toBe(a.length);
      countedFrames += a.length;
      for (let k = 0; k < a.length; k++) {
        const d = Math.abs(a[k] - b[k]);
        if (d > worst) {
          worst = d;
          worstWhere = `${label}, позиция ${positions[i]} px, анимация #${k}`;
        }
      }
    }
    report.push(`${label}: сверено ${countedFrames} значений прогресса`);
  }

  console.log(`[таймлайны] ${report.join('; ')}`);
  console.log(
    `[таймлайны] наибольшее расхождение прогресса: ${worst} (${(worst * 100).toFixed(3)} %), ` +
      `${worstWhere}`,
  );

  expect(worst, 'прогресс родных таймлайнов обязан совпадать до долей процента').toBeLessThan(
    0.005,
  );
});

/* ------------------------------------------------------------------ */
/* 3. Якоря, рельс, полоса прогресса, клавиатура — на плавном пути      */
/* ------------------------------------------------------------------ */

/** Куда фактически встаёт каждая внутренняя ссылка страницы: отступ секции
 *  от верха окна после перехода и признак «страница упёрлась в низ». Второе
 *  обязательно: последняя секция физически не может подняться под шапку —
 *  окно дальше не едет, и 90 px там недостижимы по устройству страницы, а не
 *  по вине правки. */
async function waitForScrollSettle(page: Page, quietMs = 300, timeoutMs = 8000) {
  /* Ждём ФАКТИЧЕСКОЙ остановки, а не фиксированной паузы. Родной переход по
     якорю при `scroll-behavior: smooth` длится тем дольше, чем дальше цель:
     на «Контакты» (низ страницы) он не укладывается и в 900 мс. Замер по
     таймеру показывал 677 px вместо 90 и выглядел как поломка якорей —
     сломан был замер (прогон 2026-08-20). */
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

async function anchorLandings(page: Page) {
  const hrefs = await page.locator('a[href^="#"]:not([href="#"])').evaluateAll((els) =>
    Array.from(new Set(els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? ''))),
  );
  const landings: Record<string, { top: number; atBottom: boolean }> = {};
  for (const href of hrefs) {
    const id = href.slice(1);
    if (id === 'main') continue; // skip-link ведёт на обёртку, а не на секцию
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(150);
    await page.locator(`a[href="${href}"]`).first().click();
    await waitForScrollSettle(page);
    landings[href] = await page.locator(`#${id}`).evaluate((el) => ({
      top: Math.round(el.getBoundingClientRect().top),
      atBottom:
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2,
    }));
  }
  return landings;
}

test('переходы по якорям не сдвинулись от плавной прокрутки', async ({ page, browser }) => {
  await page.goto('/');
  const smooth = await anchorLandings(page);

  expect(Object.keys(smooth).length, 'внутренних якорей на главной не нашлось — сторож ослеп')
    .toBeGreaterThan(2);

  /* Эталон — тот же обход БЕЗ Lenis. Экземпляр не создаётся при
     `prefers-reduced-motion: reduce`, и это единственный способ сравнить
     плавный путь с неплавным на одной и той же сборке.

     Вложенный `test.use({ reducedMotion: 'reduce' })` внутри `describe` здесь
     НЕ работает: файловый `use` его перекрывает, страница получает
     `no-preference`, и «эталон» молча измерил бы тот же плавный путь
     (проверено прогоном 2026-08-20). Поэтому — явный контекст. */
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: WIDE });
  const plain = await ctx.newPage();
  await plain.goto('/');
  const native = await anchorLandings(plain);
  await ctx.close();

  console.log(
    `[якоря] ${Object.entries(smooth)
      .map(([href, v]) => `${href} → ${v.top} px${v.atBottom ? ' (низ страницы)' : ''}`)
      .join(', ')}`,
  );

  expect(smooth, 'посадка якорей при плавной прокрутке обязана совпасть с обычной').toEqual(native);

  for (const [href, v] of Object.entries(smooth)) {
    if (v.atBottom) continue;
    expect(v.top, `${href}: секция обязана встать в 90 px от верха окна`).toBe(90);
  }
});

test('прокрутка с клавиатуры работает при включённой плавности', async ({ page }) => {
  await page.goto('/');
  await page.locator('#main').focus();

  const start = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(700);
  const afterPageDown = await page.evaluate(() => window.scrollY);
  expect(afterPageDown, 'PageDown обязан увести страницу вниз').toBeGreaterThan(start + 200);

  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
  const afterSpace = await page.evaluate(() => window.scrollY);
  expect(afterSpace, 'пробел обязан увести страницу ниже').toBeGreaterThan(afterPageDown);

  await page.keyboard.press('End');
  await page.waitForTimeout(1200);
  const atEnd = await page.evaluate(
    () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4,
  );
  expect(atEnd, 'End обязан довезти до низа страницы').toBe(true);

  await page.keyboard.press('Home');
  await page.waitForTimeout(1200);
  const atTop = await page.evaluate(() => window.scrollY);
  expect(atTop, 'Home обязан вернуть наверх').toBeLessThan(4);

  console.log(
    `[клавиатура] PageDown ${start} → ${afterPageDown}, пробел → ${afterSpace}, End/Home пройдены`,
  );
});

test('рельс подсвечивает раздел, в который приехали плавно', async ({ page }) => {
  await page.goto('/');

  const dots = page.locator('[data-target]');
  const dotCount = await dots.count();
  expect(dotCount, 'точек рельса не нашлось').toBeGreaterThan(3);

  await dots.nth(2).click();
  await page.waitForTimeout(1200);
  await expect(dots.nth(2)).toHaveAttribute('aria-current', 'true');

  // И обратный ход: приезжаем колесом, подсветка обязана переехать сама.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(200);
  await expect(dots.nth(0)).toHaveAttribute('aria-current', 'true');
  console.log('[рельс] клик по третьей точке и возврат наверх — подсветка следует за позицией');
});

test('полоса прогресса чтения совпадает с позицией при плавной прокрутке', async ({ page }) => {
  /* Полоса рисуется НЕ на всякой ширине: на главной от 1324 px её работу
     забирает рельс (`ReadingProgress.astro`, `mobile-only`). Замер на 1440 px
     давал ширину 0 и деление 0/0 — тест показывал NaN и выглядел как дефект
     кода. Мерить надо там, где полоса есть. */
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto('/');

  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(1200);

  const { barRatio, scrollRatio } = await page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('#reading-progress > i')!;
    const track = bar.parentElement!.getBoundingClientRect().width;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return {
      barRatio: bar.getBoundingClientRect().width / track,
      scrollRatio: window.scrollY / max,
    };
  });

  console.log(
    `[прогресс] полоса ${(barRatio * 100).toFixed(2)} %, позиция ${(scrollRatio * 100).toFixed(2)} %`,
  );
  expect(barRatio, 'полоса обязана сдвинуться').toBeGreaterThan(0.01);
  expect(Math.abs(barRatio - scrollRatio), 'полоса обязана совпасть с позицией').toBeLessThan(0.01);
});

/* ------------------------------------------------------------------ */
/* 4. При reduce плавности нет                                          */
/* ------------------------------------------------------------------ */

test('при уменьшенном движении Lenis не создан, а прокрутка мгновенная', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: WIDE });
  const page = await ctx.newPage();
  await page.goto('/');

  const cls = await page.evaluate(() => document.documentElement.className);
  expect(cls, 'при reduce на <html> не должно быть класса Lenis').not.toMatch(/(^|\s)lenis(\s|$)/);

  const { y0, trace } = await wheelTrace(page, 600, 600);
  const s = traceStats(y0, trace);
  console.log(
    `[reduce] класс <html> «${cls}», пройдено ${s.travelled} px, ` +
      `кадров с движением ${s.movingFrames}, остановка на ${s.settleAt} мс`,
  );

  expect(s.travelled, 'колесо обязано довезти на те же 600 px').toBeCloseTo(600, 0);
  expect(s.movingFrames, 'при reduce прокрутка обязана быть мгновенной').toBeLessThanOrEqual(2);
  expect(s.settleAt, 'при reduce страница не должна доезжать кадрами').toBeLessThan(80);
  await ctx.close();
});

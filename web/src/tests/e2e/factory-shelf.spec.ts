import { test, expect } from '@playwright/test';
import { FACTORY } from '../../data/factory';

/** Схема «Стеллаж» (кейс «Фабрика ботов»), Ф-2 — D-046, бриф
 *  `70-workshop/specs/site-v3/04-cases-brief.md`, раздел 6.
 *
 *  Заменяет `factory-plate.spec.ts` (снят вместе с плитой и тизером,
 *  D-048 — фабрика стала четвёртым кейсом секции, а не панелью под ней).
 *  Набор не удалён, а переписан: шесть проверок плиты охраняли требования,
 *  которые к «Стеллажу» относятся ровно так же (запасное состояние
 *  движения, раскрой без переполнения) — только разметка и числа сменились.
 *  Числа-критерии плиты (308×560 и т.п.) сюда не перенесены — ниже взяты
 *  либо числа брифа раздела 6.2/6.5 (длины рядов меток, ширина поля на
 *  390 px), либо — где брифа для конкретного пикселя нет — фактический
 *  замер с обоснованием прямо в комментарии у теста.
 *
 *  ЛОВУШКА headless-Chromium: по умолчанию он отдаёт
 *  `prefers-reduced-motion: reduce`, даже когда тест явно этого не просил —
 *  любая проверка движения обязана эмулировать `no-preference` явно, иначе
 *  «обычный путь» тихо тестирует то же самое запасное состояние, что и тест
 *  на reduce (та же ловушка, что в `background-line.spec.ts`). */

async function findShelfStylesheet(page: import('@playwright/test').Page) {
  const hrefs = await page.locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((l) => l.getAttribute('href') ?? ''));
  for (const href of hrefs) {
    const res = await page.request.get(href);
    const css = await res.text();
    if (css.includes('cf-node-in')) return { href, css };
  }
  throw new Error('стиль cf-node-in не найден ни в одном подключённом файле');
}

/** Вырезает блок `@supports (animation-timeline:view())…{…}`, который несёт
 *  анимацию «Стеллажа» (содержит `cf-node-in`) — тот же приём, что был у
 *  плиты: резать нужно ИМЕННО блок «Стеллажа», а не первый по тексту
 *  `@supports` с тем же условием (в файле их несколько: карточки, диалог,
 *  линия фона, пакеты «Заявки-Хаба», «Стеллаж» — у каждого свой). */
function cutSupportsBlock(css: string, marker: string): string {
  const needle = '@supports (animation-timeline:view())';
  let start = css.indexOf(needle);
  while (start !== -1) {
    let depth = 0;
    let end = start;
    for (let i = css.indexOf('{', start); i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) { end = i + 1; break; }
      }
    }
    if (css.slice(start, end).includes(marker)) {
      return css.slice(0, start) + css.slice(end);
    }
    start = css.indexOf(needle, end);
  }
  throw new Error(`@supports-блок с «${marker}» не найден`);
}

async function shelfStates(page: import('@playwright/test').Page) {
  const node = await page.locator('.cf-node').evaluate((el) => {
    const s = getComputedStyle(el);
    return { opacity: Number(s.opacity), animationName: s.animationName };
  });
  const caption = await page.locator('.cf-caption').evaluate((el) => {
    const s = getComputedStyle(el);
    return { opacity: Number(s.opacity), animationName: s.animationName };
  });
  const branch = await page.locator('.cf-branch').evaluate((el) => {
    const s = getComputedStyle(el);
    return { transform: s.transform, animationName: s.animationName };
  });
  const shelves = await page.locator('.cf-shelves').evaluate((el) => {
    const s = getComputedStyle(el);
    return { transform: s.transform, animationName: s.animationName };
  });
  // `::before` каждой полки несёт стержень к шине (раздел 6.2) — псевдоэлемент,
  // недоступный через `locator`, читается через второй аргумент `getComputedStyle`.
  const stems = await page.locator('.cf-shelf').evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el, '::before');
      return { transform: s.transform, animationName: s.animationName };
    }));
  const marks = await page.locator('.cf-marks').evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el);
      return { clipPath: s.clipPath, animationName: s.animationName };
    }));
  const runningAnimations = await page.locator('.cf-stellar').evaluate(
    (el) => el.getAnimations({ subtree: true }).length,
  );
  return { node, caption, branch, shelves, stems, marks, runningAnimations };
}

function expectDrawnInPlace(states: Awaited<ReturnType<typeof shelfStates>>) {
  expect(states.node.opacity).toBeGreaterThanOrEqual(0.99);
  expect(states.node.animationName).toBe('none');
  expect(states.caption.opacity).toBeGreaterThanOrEqual(0.99);
  expect(states.caption.animationName).toBe('none');

  expect(states.branch.transform === 'none').toBe(true);
  expect(states.branch.animationName).toBe('none');
  expect(states.shelves.transform === 'none').toBe(true);
  expect(states.shelves.animationName).toBe('none');

  for (const stem of states.stems) {
    expect(stem.transform === 'none').toBe(true);
    expect(stem.animationName).toBe('none');
  }
  for (const mark of states.marks) {
    expect(mark.clipPath === 'none' || /^inset\(0px(?: 0px){0,3}\)$/.test(mark.clipPath)).toBe(true);
    expect(mark.animationName).toBe('none');
  }
  expect(states.runningAnimations).toBe(0);
}

test.describe('«Стеллаж» — запасное состояние (D-024/раздел 8.1 брифа)', () => {
  test('prefers-reduced-motion: reduce — рисунок нарисован целиком, без анимаций', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.locator('.cf-stellar').scrollIntoViewIfNeeded();

    expectDrawnInPlace(await shelfStates(page));
    await ctx.close();
  });

  test('без блока @supports (animation-timeline) — тот же результат', async ({ page }) => {
    await page.goto('/');
    const { href, css } = await findShelfStylesheet(page);
    const withoutSupports = cutSupportsBlock(css, 'cf-node-in');

    expect(withoutSupports, 'вне @supports осталось назначение анимации «Стеллажа»')
      .not.toContain('animation-name:cf-node-in');

    await page.route(`**${href}`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/css', body: withoutSupports }));
    await page.reload();
    await page.locator('.cf-stellar').scrollIntoViewIfNeeded();

    expectDrawnInPlace(await shelfStates(page));
  });
});

/* Длины рядов меток — литералы брифа, раздел 6.2: «Длины ряда: 12 → 188 px,
 * 8 → 124, 6 → 92» (шаг 16 = 12px метка + 4px промежуток, без легенды).
 * Считать её здесь заново нельзя — это то самое число, которое несёт
 * сообщение «готового много, и это видно без пересчёта» (раздел 6.2). */
const EXPECTED_ROW_WIDTH: Record<number, number> = { 12: 188, 8: 124, 6: 92 };

test.describe('«Стеллаж» — раскрой 1440/1100, раскрой А (критерий 9 брифа)', () => {
  for (const width of [1440, 1100] as const) {
    test(`${width}px: схема укладывается в поле без переполнения, лестница длин рядов сохранена`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/');
      const stellar = page.locator('.cf-stellar');
      await stellar.scrollIntoViewIfNeeded();

      // Схема заполняет всё поле рисунка (`.field`, отступ 32 паспарту) —
      // не шире и не уже него: `.cf-stellar { flex: 1 }` внутри `.field`.
      const field = await page.locator('.field').filter({ has: stellar })
        .first().evaluate((el) => el.getBoundingClientRect());
      const stellarBox = await stellar.evaluate((el) => el.getBoundingClientRect());
      expect(stellarBox.width, 'рисунок уже своего поля').toBeLessThanOrEqual(field.width + 1);
      expect(stellarBox.right - field.right, 'рисунок переполняет поле справа').toBeLessThanOrEqual(1);

      // `.cf-marks` — flex-контейнер внутри колонки `.cf-shelf`: браузер
      // растягивает его по ширине колонки (`align-items: stretch`), а
      // фактические метки при этом остаются прижаты к левому краю без
      // переноса. Поэтому длина ряда — не ширина контейнера, а расстояние
      // от левого края первой метки до правого края последней.
      const rowWidths = await page.locator('.cf-marks').evaluateAll((els) =>
        els.map((el) => {
          const marks = Array.from(el.querySelectorAll('.cf-mark'));
          const first = marks[0].getBoundingClientRect();
          const last = marks[marks.length - 1].getBoundingClientRect();
          return last.right - first.left;
        }));
      expect(rowWidths).toHaveLength(FACTORY.length);
      FACTORY.forEach((t, i) => {
        const expected = EXPECTED_ROW_WIDTH[t.themes];
        expect(expected, `в брифе нет ожидаемой длины ряда для ${t.themes} тем`).toBeDefined();
        expect(Math.abs(rowWidths[i] - expected), `ряд «${t.label}» ${rowWidths[i]}px, ожидалось ${expected}px`)
          .toBeLessThanOrEqual(1);
      });

      const overflowing = await page.locator('.cf-shelf-label, .cf-marks, .cf-node-label')
        .evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1).length);
      expect(overflowing, 'текст или ряд меток выходит за свою колонку').toBe(0);

      const horizontalScroll = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(horizontalScroll).toBe(0);
    });
  }
});

test.describe('«Стеллаж» — раскрой 390, раскрой Б (критерий 9 брифа)', () => {
  test('390px: поле не шире доступной ширины, ряд из 12 меток не переносится, без горизонтальной прокрутки', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/');
    const stellar = page.locator('.cf-stellar');
    await stellar.scrollIntoViewIfNeeded();

    // 390 px экрана − 32 поля страницы − 64 паспарту = 294 px содержимого
    // поля (раздел 6.5 брифа, дословно) — единственный литерал брифа для
    // этой ширины; лестница длин рядов при этом не меняет шаг (раздел 6.5:
    // «единственный из вариантов, у которого мобильный раскрой не теряет
    // длину»), поэтому ряд из 12 меток остаётся 188 px и должен уместиться
    // в 294 px, не перенесясь на вторую строку.
    const box = await stellar.evaluate((el) => el.getBoundingClientRect());
    expect(box.width, 'поле «Стеллажа» шире расчётной доступной ширины 294px').toBeLessThanOrEqual(294 + 1);

    const bookingRow = FACTORY.findIndex((t) => t.themes === 12);
    expect(bookingRow, 'в FACTORY нет ряда с 12 темами — эталон 188px нечем проверить').toBeGreaterThanOrEqual(0);
    const rowBox = await page.locator('.cf-marks').nth(bookingRow).evaluate((el) => {
      const marks = Array.from(el.querySelectorAll('.cf-mark'));
      const first = marks[0].getBoundingClientRect();
      const last = marks[marks.length - 1].getBoundingClientRect();
      const rows = new Set(marks.map((c) => Math.round(c.getBoundingClientRect().top)));
      return { width: last.right - first.left, rows: rows.size };
    });
    expect(Math.abs(rowBox.width - 188), `ряд 12 меток на 390px — ${rowBox.width}px, ожидалось 188px`)
      .toBeLessThanOrEqual(1);
    expect(rowBox.rows, 'ряд из 12 меток перенёсся на вторую строку').toBe(1);

    // Высота поля на 390px зафиксирована (`FACTORY_MOBILE_HEIGHT` = 416,
    // Cases.astro) и вырезана `overflow: clip` — содержимое, не уместившееся
    // в неё, будет молча обрезано, а не «просто выше». Единственный способ
    // отличить «в разумных пределах» от скрытого дефекта — сверить фактическую
    // высоту содержимого с высотой поля: подпись пучка обязана остаться видимой.
    const captionBottom = await page.locator('.cf-caption').evaluate((el) => el.getBoundingClientRect().bottom);
    const fieldBottom = await page.locator('.field').filter({ has: stellar }).first()
      .evaluate((el) => el.getBoundingClientRect().bottom);
    expect(captionBottom, 'подпись пучка обрезана нижним краем поля (переполнение выше 416px)')
      .toBeLessThanOrEqual(fieldBottom + 1);

    const overflowing = await page.locator('.cf-stellar *').evaluateAll((els) =>
      els.filter((el) => el.scrollWidth > el.clientWidth + 1).length);
    expect(overflowing, 'переполнение внутри «Стеллажа» на 390px').toBe(0);

    const horizontalScroll = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(horizontalScroll).toBe(0);
  });
});

/* Бриф, раздел 6.7 / критерий 13.10: «Заявка-Хаб» и «Фабрика ботов» в одном
 * экране не должны читаться как одна и та же схема. Полное «на глаз читаются
 * по-разному» — эстетическое суждение, которое эта проверка не имитирует.
 * Машиной здесь проверен необходимый структурный минимум: два соседних блока
 * физически нарисованы разной техникой (векторные пути SVG у «Заявки-Хаба»
 * против HTML-прямоугольников у «Стеллажа», раздел 6.1: «ни одного <svg>») —
 * без этого условия совпадение схем было бы неизбежным, а не вкусовым.
 * Дальше — за глазом. */
test.describe('«Заявка-Хаб» и «Стеллаж» рядом — не читаются как одна схема (критерий 13.10)', () => {
  for (const width of [1440, 390] as const) {
    test(`${width}px: разное устройство разметки — SVG-схема против HTML-схемы`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/');
      const hub = page.locator('.flow');
      const factory = page.locator('.cf-stellar');
      await factory.scrollIntoViewIfNeeded();

      await expect(hub).toBeVisible();
      await expect(factory).toBeVisible();

      const hubSvgCount = await hub.locator('svg').count();
      expect(hubSvgCount, '«Заявка-Хаб» рисуется SVG-путями').toBeGreaterThan(0);

      const factorySvgFree = await factory.locator('svg, canvas, img').count();
      expect(factorySvgFree, '«Стеллаж» — HTML/CSS без SVG/canvas/img (раздел 6.1)').toBe(0);
    });
  }
});

import { test, expect } from '@playwright/test';

/** Сторож П-8 — которого у самой правки не было (заход 2026-08-26,
 *  `09-footer-brief.md`, раздел 15, «правка 3»). Коммит `6585d50` уже снял
 *  полосу прокрутки на `/404` при 1440×900 (`.ways`/`.tagline` сдвинуты на
 *  ступень вниз по шкале отступов, −12 px), подтверждено тогда ручным
 *  замером: `docH` 900 против `innerH` 900. Своего теста у той правки не
 *  было — регресс мог вернуться молча в любой следующий заход, в том числе
 *  тем же самым, что чинил П-8: любая правка высоты тела `/404` (например,
 *  Б-3 этого же захода — вертикальное центрирование на высоких мониторах)
 *  трогает ровно тот же бюджет 11 px.
 *
 *  Проверка — `document.documentElement.scrollHeight` не больше
 *  `window.innerHeight` на 1440×900, то есть полосы прокрутки нет вовсе
 *  (страница помещается в высоту окна без остатка). Обе страницы, у которых
 *  есть свой `siteTagline` (раздел 7.5 брифа): `/404` и `/en/404` — список
 *  не выведен из сборки (страниц с этим маркером ровно две и они названы в
 *  самом брифе, ловушка 15 `50-code/CLAUDE.md` про перечисление вручную
 *  здесь неприменима: множество страниц-адресатов этой конкретной правки
 *  зафиксировано брифом, а не совпадает с «все страницы сборки»).
 *
 *  Красный прогон, которым это доказано (см. отчёт исполнителя): временный
 *  откат Б-3 (`.short-page`/`main:has()` убраны, а `.ways`/`.tagline`
 *  возвращены на числа ДО П-8 — `margin-top: 24px`/`24px`) даёт `docH` 911
 *  против `innerH` 900 на `/404` — тот же дефект, что чинил П-8 изначально,
 *  и тест падает. */

const PAGES = ['/404', '/en/404'] as const;

for (const path of PAGES) {
  test(`${path} @ 1440×900 не даёт полосы прокрутки`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.goto(path);

    const { docH, innerH } = await page.evaluate(() => ({
      docH: document.documentElement.scrollHeight,
      innerH: window.innerHeight,
    }));

    expect(
      docH,
      `${path} @ 1440×900: document.documentElement.scrollHeight=${docH}px, window.innerHeight=${innerH}px — полоса прокрутки появляется, когда первое больше второго`,
    ).toBeLessThanOrEqual(innerH);

    await ctx.close();
  });
}

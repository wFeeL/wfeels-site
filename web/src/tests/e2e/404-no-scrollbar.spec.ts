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
 *  ПРАВКА 2026-08-28 (`70-workshop/specs/site-v3/13-short-pages-brief.md`,
 *  раздел 4.10, критерий приёмки 2, вариант A «Указатель», D-129): список
 *  страниц вырос с двух до четырёх — `/thanks` и `/en/thanks` несут тот же
 *  маркер `[data-short-page]` и ту же правку вертикали (раздел 4.5 брифа),
 *  и полоса прокрутки у них по факту снята той же самой правкой, поэтому
 *  их отсутствие в списке было бы дырой покрытия, а не экономией. Список
 *  высот вырос с одной точки до двух: 1440×900 — точка, где запас всегда
 *  был минимальным (1 px до правки этого захода), и 1440×860 — новая точка
 *  раздела 4.10 (сегодня `/404` там даёт +39 px без полосы действия). */

const PAGES = ['/404', '/en/404', '/thanks', '/en/thanks'] as const;
const HEIGHTS = [900, 860] as const;

for (const path of PAGES) {
  for (const height of HEIGHTS) {
    test(`${path} @ 1440×${height} не даёт полосы прокрутки`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height },
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
        `${path} @ 1440×${height}: document.documentElement.scrollHeight=${docH}px, window.innerHeight=${innerH}px — полоса прокрутки появляется, когда первое больше второго`,
      ).toBeLessThanOrEqual(innerH);

      await ctx.close();
    });
  }
}

import { test, expect } from '@playwright/test';

/* Дизайн-ревью 2026-08-22 (находка «три кольца фокуса»): рецензент замерил
 * `outline` на нескольких остановках табуляции и получил три разных значения
 * — 2px синий, 3px почти чёрный (`--text`) и 3px синий. Сторож ниже проходит
 * ВСЕ семь страниц в ОБЕИХ темах и требует, чтобы `outline` совпадал на
 * КАЖДОЙ остановке табуляции внутри страницы — не только на первой (ловушка
 * 8, `50-code/CLAUDE.md`: проверка обязана покрывать полосу параметров, а не
 * точку).
 *
 * `.status` в LeadForm.astro — намеренное исключение (комментарий у
 * `.status:focus-visible { outline: none }`): панель результата получает
 * фокус программно (`tabindex="-1"`), Tab на неё никогда не попадает, и
 * сторож её не встречает. */

const PAGES = ['/', '/contact', '/consent', '/privacy', '/terms', '/thanks', '/404.html'];
const THEMES = ['light', 'dark'] as const;

/** Проходит табуляцией страницу и возвращает `outline`/`outline-offset`
 *  каждой остановки до возврата на первую (циклический обход клавиатурой). */
async function walkFocusRing(page: import('@playwright/test').Page) {
  const stops: { outline: string; offset: string }[] = [];
  let firstId: string | null = null;
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as (HTMLElement & { dataset: DOMStringMap }) | null;
      if (!el || el === document.body) return null;
      if (!el.dataset.__fid) el.dataset.__fid = 'fid' + Math.random().toString(36).slice(2);
      const cs = getComputedStyle(el);
      return {
        fid: el.dataset.__fid,
        outline: `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}`,
        offset: cs.outlineOffset,
      };
    });
    if (!info) break;
    if (firstId === null) firstId = info.fid;
    else if (info.fid === firstId) break; // цикл замкнулся — обошли все остановки
    stops.push({ outline: info.outline, offset: info.offset });
    if (stops.length > 100) break; // предохранитель от зависшего цикла
  }
  return stops;
}

for (const theme of THEMES) {
  test.describe(`кольцо фокуса — тема ${theme}`, () => {
    for (const path of PAGES) {
      test(`${path || '/'}: одно значение outline на всех остановках табуляции`,
        async ({ browser }) => {
          const ctx = await browser.newContext({ colorScheme: theme });
          const page = await ctx.newPage();
          await page.goto(path);

          const stops = await walkFocusRing(page);
          expect(stops.length, 'на странице не нашлось ни одной остановки табуляции — сторож ослеп')
            .toBeGreaterThan(0);

          const variants = new Set(stops.map((s) => `${s.outline} | offset ${s.offset}`));
          expect(
            [...variants],
            `страница ${path} даёт ${variants.size} разных колец фокуса на ${stops.length} остановках вместо одного`,
          ).toHaveLength(1);

          await ctx.close();
        });
    }
  });
}

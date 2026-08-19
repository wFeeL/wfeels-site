import { test, expect } from '@playwright/test';

/* Раскрой иллюстрации «Замер» помещается в своё поле целиком — на каждой
 * ширине, а не «на той, где смотрели».
 *
 * Почему это отдельный сторож, а не глазомер. Ровно этот класс дефекта месяц
 * жил в соседней иллюстрации незамеченным: на 900…1179 px рисунок срезался на
 * 194 px — сорок процентов, включая весь смысловой конец. Ни один тест этого
 * не видел, потому что ни один не измерял. А в самой этой иллюстрации, в
 * прежней композиции, на 390 px строка мелких метрик налезала на подпись
 * коэффициента — два текста в одной точке.
 *
 * Поэтому здесь три измерения, и все три — замер, а не расчёт:
 *   1) содержимое не выходит за поле (`.field` стоит на `overflow: clip` —
 *      переполнение не прокрутится, а обрежется молча);
 *   2) ни одна пара текстовых блоков рисунка не перекрывается;
 *   3) кегль любого текста рисунка не ниже 14 px на экране.
 */

/* Замер идёт по КОНЕЧНОМУ состоянию рисунка. Контекст Playwright по умолчанию
   отдаёт `no-preference`, и тогда в клетках стоял бы кадр счётчика («0 КБ»
   вместо «400 КБ») — сторож переполнения мерил бы текст короче настоящего и
   был бы снисходительнее, чем обязан. */
test.use({ reducedMotion: 'reduce' });

const ILLO = '[data-illustration="case-weight"]';
const TEXTS = [
  '[data-cell] [data-count]',
  '[data-cell] .c',
  '[data-cell="verdict"] .mult',
  '[data-cell="verdict"] .phrase',
  '[data-cell="link"]',
];

/** Ширины: 390 — узкий телефон, 900 — точка перелома раскладки, 1180 —
 *  ширина контейнера, 1440 — типичный десктоп. */
const WIDTHS = [390, 900, 1180, 1440];

for (const width of WIDTHS) {
  test(`раскрой «Замера» держится в поле на ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.locator(ILLO).scrollIntoViewIfNeeded();

    const field = page.locator(ILLO).locator('xpath=ancestor::div[contains(@class,"field")][1]');
    const box = await field.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        top: r.top + parseFloat(cs.paddingTop),
        bottom: r.bottom - parseFloat(cs.paddingBottom),
        left: r.left + parseFloat(cs.paddingLeft),
        right: r.right - parseFloat(cs.paddingRight),
      };
    });

    const items = await page.locator(ILLO).evaluate((root, selectors) => {
      const out: { sel: string; text: string; rect: DOMRect; size: number }[] = [];
      for (const sel of selectors) {
        root.querySelectorAll(sel).forEach((el) => {
          out.push({
            sel,
            text: (el.textContent ?? '').trim().slice(0, 40),
            rect: el.getBoundingClientRect().toJSON(),
            size: parseFloat(getComputedStyle(el).fontSize),
          });
        });
      }
      return out;
    }, TEXTS);

    expect(items.length, 'тексты рисунка не нашлись — сторож проверял бы пустоту').toBeGreaterThan(8);

    // 1. Ничего не вылезло за содержательную область поля. Допуск 0,5 px —
    //    субпиксельное округление браузера, не «немножко можно».
    const spilled = items
      .filter((i) => i.rect.top < box.top - 0.5 || i.rect.bottom > box.bottom + 0.5 ||
        i.rect.left < box.left - 0.5 || i.rect.right > box.right + 0.5)
      .map((i) => `«${i.text}» ${JSON.stringify(i.rect)} вне ${JSON.stringify(box)}`);
    expect(spilled, `на ${width} px рисунок не помещается в поле:\n${spilled.join('\n')}`).toEqual([]);

    // 2. Ни один текст не налезает на другой. Именно так выглядел известный
    //    дефект на 390 px: «2,5 КБ JS · 0 сторонних скриптов» поверх подписи
    //    коэффициента.
    const overlaps: string[] = [];
    for (let a = 0; a < items.length; a++) {
      for (let b = a + 1; b < items.length; b++) {
        const A = items[a].rect;
        const B = items[b].rect;
        const dx = Math.min(A.right, B.right) - Math.max(A.left, B.left);
        const dy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
        if (dx > 0.5 && dy > 0.5) overlaps.push(`«${items[a].text}» × «${items[b].text}»`);
      }
    }
    expect(overlaps, `на ${width} px тексты рисунка перекрываются:\n${overlaps.join('\n')}`).toEqual([]);

    // 3. Кегль — замер на экране, а не вера в rem: 14 px нижняя граница
    //    читаемости подписи внутри рисунка (бриф, раздел 2.3).
    const tiny = items.filter((i) => i.size < 14).map((i) => `«${i.text}» — ${i.size}px`);
    expect(tiny, `на ${width} px кегль ниже 14 px:\n${tiny.join('\n')}`).toEqual([]);
  });
}

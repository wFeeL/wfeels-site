import { test, expect } from '@playwright/test';

/** Сторож П-Ф-Б1 (`70-workshop/specs/site-v3/16-line-digits-and-finale-brief.md`,
 *  раздел 4.4): «на упоре прокрутки экранное положение головы равно `100vh`
 *  ± 2 px на каждой из пяти названных комбинаций окна — недостижимой полосы
 *  нет ни на одной». Это тот самый файл, на который `background-line-ink-
 *  continuity.spec.ts` (комментарий у П-Э2) ссылается как на сторожа,
 *  отдельно измеряющего П-Ф-Б1: там сквозной скан проверяет, что шторка
 *  следует формуле разгона НА ВСЁМ протяжении прокрутки, здесь — что формула
 *  на самом упоре действительно доводит голову ровно до нижней кромки окна,
 *  а не до какой-то произвольной точки внутри недостижимой полосы.
 *
 *  ПОЧЕМУ ПЯТЬ КОМБИНАЦИЙ ОКНА, А НЕ ОДНА. Недостижимая полоса — не
 *  константа, а функция высоты окна (`BackgroundLine.astro`, инвариант у
 *  `--line-head`):
 *
 *    недостижимая полоса = 100vh − --line-head = min(0,2·vh, 347px)
 *
 *  что даёт 180 / 240 / 300 / 347 px при высоте окна 900 / 1200 / 1500 /
 *  ≥1735 — и это ровно то, ради чего существует разгон (`line-finish`):
 *  без него голова на большей части настольных окон не дошла бы до подвала
 *  вовсе. На 1440×1500 голова в подвал раньше (до разгона) не заходила
 *  вовсе (заход = высота подвала 289 − недостижимая полоса 300 = −11px) —
 *  именно этот случай отличает «работает на 900» от «работает всегда»:
 *  сторож, проверяющий одну высоту окна, эту поломку пропустит начисто,
 *  потому что на 900 её не существует физически (полоса там уже 180, заход
 *  положительный и без разгона). Ширина участвует потому, что раскладка
 *  секций и высота подвала (footer) зависят от неё (просвет рельса на
 *  1324…1486, перенос строк реквизитов подвала на узких десктопных
 *  ширинах) — 900/1440/1920 держат три характерных ширины линии, а 1200 и
 *  1500 добавляют к 1440 средние и большие мониторы, где недостижимая
 *  полоса уже выросла, но ещё не насыщена (347).
 *
 *  МЕТОД. Прокрутить документ до конца (`document.documentElement.
 *  scrollHeight − window.innerHeight`), дождаться двух `requestAnimationFrame`
 *  (раскладка `position: fixed`-элемента пересчитывается на кадре
 *  компоновки, не синхронно со `scrollTo()` — тот же приём, что уже стоит во
 *  всех сторожах линии этого репозитория). `document.documentElement.
 *  scrollHeight` у этой страницы растёт по мере приближения прокрутки к
 *  подвалу (`background-line-ink-continuity.spec.ts`, JSDoc `InkSample.
 *  docScrollHeight` — оверфлоу подвала за пределы `viewBox`, обрезанный
 *  только по X) — поэтому после первого `scrollTo` до предварительного
 *  максимума позиция переизмеряется и скролл повторяется до УЖЕ живого
 *  максимума, а не до значения, снятого один раз до прокрутки. Снять
 *  `curtainTop = document.querySelector('.line-curtain').getBoundingClientRect().top`.
 *  Требование П-Ф-Б1: `curtainTop − innerHeight === 0` с допуском ±2 px —
 *  «голова стоит ровно на нижней кромке окна», не «где-то рядом». */

const COMBOS = [
  { width: 900, height: 900 },
  { width: 1440, height: 900 },
  { width: 1440, height: 1200 },
  { width: 1440, height: 1500 },
  { width: 1920, height: 900 },
] as const;

async function scrollToLiveMax(page: import('@playwright/test').Page) {
  const settle = () =>
    page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  // Первый проход — к предварительному максимуму.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight - window.innerHeight));
  await settle();
  // `scrollHeight` мог вырасти по мере приближения к подвалу (см. JSDoc
  // выше) — повторный проход берёт УЖЕ живой максимум.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight - window.innerHeight));
  await settle();
}

test.describe('линия на фоне — финал: голова доходит до нижней кромки окна на упоре прокрутки (П-Ф-Б1)', () => {
  for (const { width, height } of COMBOS) {
    test(`${width}×${height}: curtainTop − innerHeight = 0 ± 2px на maxScroll`, async ({ browser }) => {
      const ctx = await browser.newContext({
        reducedMotion: 'no-preference',
        viewport: { width, height },
      });
      const page = await ctx.newPage();
      await page.goto('/');
      await page.waitForTimeout(1600); // line-load героя (раздел 2.6 брифа `15-…`), 1400ms + запас.

      await scrollToLiveMax(page);

      const { maxScroll, curtainTop, innerHeight, overshoot } = await page.evaluate(() => {
        const vh = window.innerHeight;
        const curtain = document.querySelector('.line-curtain') as HTMLElement;
        const top = curtain.getBoundingClientRect().top;
        return {
          maxScroll: document.documentElement.scrollHeight - vh,
          curtainTop: top,
          innerHeight: vh,
          overshoot: top - vh,
        };
      });
      await ctx.close();

      expect(maxScroll, 'страница не прокручивается — дошагать до упора нечем').toBeGreaterThan(300);
      expect(
        Math.abs(overshoot),
        `${width}×${height}: curtainTop=${curtainTop.toFixed(1)}, innerHeight=${innerHeight}, ` +
          `maxScroll=${maxScroll}, разница ${overshoot.toFixed(1)}px — голова не доходит до нижней ` +
          `кромки окна (недостижимая полоса осталась, П-Ф-Б1 нарушен)`,
      ).toBeLessThanOrEqual(2);
    });
  }
});

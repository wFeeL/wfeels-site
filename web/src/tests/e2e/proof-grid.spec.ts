import { test, expect } from '@playwright/test';

/** Секция 6 «Что можно проверить» обязана принять четвёртую и пятую карточку
 *  (спека 05) без переделки разметки (план `02-home-plan.md`, задача 10,
 *  «Разметка обязана допускать добавление двух карточек в спеке 05 без
 *  переделки секции. Сетка, а не три жёстко заданных места»).
 *
 *  Спеки 05 сегодня нет, а значит и текста для четвёртой/пятой карточки —
 *  тоже (тексты не сочиняются, план `02-home-plan.md`, общее ограничение).
 *  Тест поэтому не пишет новый текст: он клонирует существующую карточку с
 *  заведомо более длинным содержимым (сборка страницы этого не гарантирует
 *  сегодня, но обязана выдержать в будущем) и проверяет ГЕОМЕТРИЮ, а не
 *  контент — что сетка `repeat(auto-fit, minmax(...))` (`Proof.astro`)
 *  принимает пять элементов без наложения карточек друг на друга и без
 *  горизонтального переполнения контейнера, на обеих контрольных ширинах. */
const WIDTHS: Array<{ label: string; width: number; height: number }> = [
  { label: '1440', width: 1440, height: 1000 },
  { label: '390', width: 390, height: 1200 },
];

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

for (const { label, width, height } of WIDTHS) {
  test(`секция 6: пять карточек не ломают раскладку на ${label} px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');

    const added = await page.evaluate(() => {
      const grid = document.querySelector('[data-proof-grid]');
      if (!grid) return null;
      const first = grid.querySelector('.card');
      if (!first) return null;
      const longText =
        'Пятая карточка спеки 05, размерами заведомо больше остальных: ' +
        'два-три предложения подряд, чтобы проверить, что сетка не ломается ' +
        'от лишнего объёма текста внутри одной ячейки, а не только от числа ячеек.';
      let insertedCount = 0;
      for (let i = 0; i < 2; i++) {
        const clone = first.cloneNode(true) as HTMLElement;
        const p = clone.querySelector('p');
        if (p) p.textContent = longText;
        grid.appendChild(clone);
        insertedCount++;
      }
      return insertedCount;
    });
    expect(added, 'сетка секции 6 не найдена в разметке').toBe(2);

    const cardsBoxes = await page.locator('[data-proof-grid] .card').evaluateAll(
      (cards) => cards.map((c) => {
        const r = c.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }),
    );
    expect(cardsBoxes.length, 'ожидалось три исходных плюс два клонированных').toBe(5);

    // Ни одна карточка не наезжает на соседнюю.
    for (let i = 0; i < cardsBoxes.length; i++) {
      for (let j = i + 1; j < cardsBoxes.length; j++) {
        expect(
          rectsOverlap(cardsBoxes[i], cardsBoxes[j]),
          `карточки ${i} и ${j} перекрываются на ${label} px`,
        ).toBe(false);
      }
    }

    // Ни одна карточка не вылезает за пределы окна по горизонтали —
    // признак того, что сетка не справилась с объёмом и потекла вбок.
    for (const [i, box] of cardsBoxes.entries()) {
      expect(box.x, `карточка ${i} уходит левее окна на ${label} px`).toBeGreaterThanOrEqual(0);
      expect(
        box.x + box.width,
        `карточка ${i} уходит за правый край окна на ${label} px`,
      ).toBeLessThanOrEqual(width + 1);
    }

    // Полосы горизонтальной прокрутки быть не должно ни при каком числе карточек.
    const hasHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasHorizontalScroll, `горизонтальная прокрутка появилась на ${label} px`).toBe(false);
  });
}

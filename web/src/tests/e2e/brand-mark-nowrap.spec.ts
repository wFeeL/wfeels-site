import { test, expect } from '@playwright/test';
import { ABOUT_BLOCKS } from '../../data/about';
import { splitBrandText } from '../../lib/brandMarkers';

/* Сторож неразрывности пары «фирменный знак + слово» в секции 9 «Обо мне».
 *
 * Дефект, по следу которого заведён (снимок владельца 2026-08-20, 1440 px):
 * знак Postgres встал ПОСЛЕДНИМ видимым элементом строки, а слово «Postgres»
 * перенеслось вниз — знак повис одиноким пятном на краю меры.
 *
 * Владелец правит тексты этой секции сам, поэтому сторож проверяет МЕХАНИЗМ,
 * а не конкретное предложение: правило обязано держаться при любых словах и
 * на любой ширине, иначе тот же дефект вернётся первой же правкой текста.
 *
 * Замер, а не вера в CSS: сверяется вертикальная координата знака и первого
 * слова после него. Совпали — они на одной строке; разошлись — между ними
 * прошёл перенос, то есть знак и есть последний элемент своей строки.
 *
 * Сравниваются СЕРЕДИНЫ, а не верхние кромки, и порог — половина межстрочника
 * абзаца. Это не послабление: у знака своя высота (ровно 1em) и своя посадка
 * на строку (`vertical-align: -0.15em`), поэтому верх знака и верх соседнего
 * слова не совпадают никогда — замер верхних кромок дал бы 1,7 px расхождения
 * на ровной строке и ловил бы посадку знака вместо переноса. Перенос же
 * сдвигает пару на ЦЕЛЫЙ межстрочник (в этом абзаце ≈ 30 px), то есть вдвое
 * больше порога: разница между «на одной строке» и «на разных» здесь не
 * тонкая, и порог стоит ровно посередине между двумя состояниями.
 * Проверять `white-space: nowrap` вычисленным стилем было бы проверкой
 * НАМЕРЕНИЯ: свойство стоит, а перенос всё равно случился бы, если бы пару
 * когда-нибудь собрали из двух отдельных обёрток.
 *
 * Ширины — те, на которых секция меняет раскрой: 1440 (снимок владельца),
 * 1180 (`--container`, ноутбук), 900 и 390 (одноколоночная раскладка секции
 * начинается ниже 700, 390 — телефон задания).
 *
 * `reducedMotion: 'reduce'` — секция несёт «дыхание» фотографии, которое
 * двигает только картинку, но лишнее движение на странице делает замер
 * дороже и ничего не добавляет: раскладка текста от него не зависит.
 */

test.use({ reducedMotion: 'reduce' });

/** Сколько пар «знак + слово» стоит в текстах секции. Число не написано
 *  рукой — оно выводится из тех же данных, что и разметка: пропавший маркер
 *  обязан уронить сторож, а не тихо уменьшить и проверку, и страницу. */
const EXPECTED_PAIRS = ABOUT_BLOCKS.reduce(
  (n, text) => n + splitBrandText(text).filter((p) => p.kind === 'mark').length,
  0,
);

const WIDTHS = [1440, 1180, 900, 390];

test.describe('секция 9 — фирменный знак не висит один на краю строки', () => {
  for (const width of WIDTHS) {
    test(`${width} px: каждый знак стоит на одной строке со своим словом`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/');

      /* Шрифты обязаны доехать ДО замера: на запасном шрифте ширина слов
         другая, и перенос строки встаёт не там, где встанет у читателя. */
      await page.evaluate(() => document.fonts.ready);

      const pairs = page.locator('#about [data-brand-pair]');
      await expect(
        pairs,
        `в секции ожидается ${EXPECTED_PAIRS} пар «знак + слово» (по маркерам в data/about.ts)`,
      ).toHaveCount(EXPECTED_PAIRS);

      const measured = await pairs.evaluateAll((nodes) =>
        nodes.map((node) => {
          const el = node as HTMLElement;
          const mark = el.querySelector('svg') as SVGElement;
          const word = el.querySelector('[data-brand-word]') as HTMLElement;
          const m = mark.getBoundingClientRect();
          const w = word.getBoundingClientRect();
          const paragraph = el.closest('p') as HTMLElement;
          return {
            name: el.dataset.brandPair ?? '?',
            text: word.textContent ?? '',
            markMid: m.top + m.height / 2,
            markRight: m.right,
            wordMid: w.top + w.height / 2,
            wordLeft: w.left,
            lineHeight: parseFloat(getComputedStyle(paragraph).lineHeight),
            // Число прямоугольников слова: два и больше означало бы, что
            // перенос прошёл внутри самого слова.
            wordRects: word.getClientRects().length,
          };
        }),
      );

      for (const m of measured) {
        const drift = Math.abs(m.wordMid - m.markMid);
        expect(
          drift,
          `{${m.name}}: знак и слово «${m.text}» на разных строках — ` +
            `середины разошлись на ${drift.toFixed(1)} px при межстрочнике ` +
            `${m.lineHeight.toFixed(1)} px. Значит знак оказался последним ` +
            'видимым элементом своей строки.',
        ).toBeLessThan(m.lineHeight / 2);

        expect(
          m.wordLeft,
          `{${m.name}}: слово «${m.text}» стоит ЛЕВЕЕ знака — порядок пары нарушен`,
        ).toBeGreaterThanOrEqual(m.markRight - 1);

        expect(
          m.wordRects,
          `{${m.name}}: слово «${m.text}» разорвано переносом внутри себя`,
        ).toBe(1);
      }
    });
  }
});

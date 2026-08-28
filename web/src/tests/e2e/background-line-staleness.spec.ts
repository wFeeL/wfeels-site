import { test, expect } from '@playwright/test';
import { HOME_SECTIONS } from '../../lib/sections';
import {
  MEASURED_FOOTER_HEIGHT,
  MEASURED_SECTION_HEIGHT,
  MEASURED_SECTION_HEIGHT_1440,
} from '../../lib/backgroundLine';

/** Сторож устаревания измеренных высот (бриф `70-workshop/specs/site-v3/
 *  05-line.md`, раздел 10, шаг 3в). Пути линии рисуются под КОНКРЕТНЫЕ
 *  высоты секций (`vbH = round(1000 · H / 1180)`, раздел 4.1) — перевёрстка
 *  секции меняет её реальную высоту, а `MEASURED_SECTION_HEIGHT` молчит и не
 *  меняется вместе с ней: путь остаётся привязан к СТАРОЙ высоте, и линия
 *  либо не дотягивается до низа секции, либо переезжает за него.
 *
 *  Сторож ловит это ДО того, как рисунок разъедется: сверяет реальную
 *  высоту каждой секции при ширине 1180 px (`--container`, тот же ориентир,
 *  на котором посчитан `vbH`) с измеренным числом из `backgroundLine.ts` и
 *  падает, если расхождение превышает порог.
 *
 *  **ДВЕ ПРОВЕРКИ ВМЕСТО ОДНОЙ, `2026-08-28`** (`70-workshop/specs/site-v3/
 *  18-line-lower-route-brief.md`, раздел 3.1 п.3 / П-8):
 *
 *  (а) На 1180 — допуск УЖЕСТОЧЁН до 3% для четырёх секций МАРШРУТА
 *      (`guarantees`, `about`, `faq`, `contact`): при переходе через стык
 *      15% высоты `about` — это 85 vb смещения при полосе перекрытия 60 vb,
 *      то есть старый порог пропустил бы разъехавшийся стык. Остальные
 *      секции реестра держат прежние 15% — они не несут перехода через
 *      стык, и цена ложного срабатывания на дрейфе текста для них не
 *      изменилась.
 *  (б) На 1440 — ВТОРАЯ проверка, которой раньше не было вовсе: секции,
 *      РЕАЛЬНАЯ высота которых зависит от ширины окна (`cases`, `faq`,
 *      `contact` — записаны в `MEASURED_SECTION_HEIGHT_1440`), сверяются с
 *      этой таблицей (допуск 3%); секции, которых там нет, обязаны иметь на
 *      1440 ТУ ЖЕ высоту, что на 1180, в пределах 0,5% (раздел 3.1 брифа
 *      `18-…`: «сегодня выполняется у семи секций буквально, расхождение
 *      0,00%») — если завтра правка сделает ЕЩЁ одну секцию зависимой от
 *      ширины и забудет завести для неё запись в `MEASURED_SECTION_HEIGHT_
 *      1440`, эта проверка красна, а не молчит.
 *
 *  Порог не строгий (не `±1 px`, как у сторожей самого рисунка, `rail.spec.
 *  ts`): секции главной несут живой текст (заглушки задачи 2 сменятся
 *  настоящей копией, `--stroke-line` и переносы строк слегка гуляют между
 *  сборками), и цель сторожа — поймать РАССОГЛАСОВАНИЕ верстки и таблицы
 *  (перестроили секцию, забыли переизмерить), а не любой суб-пиксельный
 *  дрейф текста. */

const STALENESS_TOLERANCE = 0.15;
const ROUTE_STALENESS_TOLERANCE = 0.03; // П-8а: секции маршрута — допуск 3%, не 15%
const ROUTE_SECTIONS = new Set(['guarantees', 'about', 'faq', 'contact']);
const WIDTH_1440_TOLERANCE = 0.03; // П-8б: секция есть в MEASURED_SECTION_HEIGHT_1440
const WIDTH_MATCH_TOLERANCE = 0.005; // П-8б: секции нет в таблице — 1440 обязан совпасть с 1180

test.describe('линия на фоне — сторож устаревания измеренных высот, П-8а (1180 px)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 900 });
    await page.goto('/');
  });

  for (const section of HOME_SECTIONS) {
    const tolerance = ROUTE_SECTIONS.has(section.id) ? ROUTE_STALENESS_TOLERANCE : STALENESS_TOLERANCE;
    test(`${section.id}: реальная высота при 1180 px в пределах ${(tolerance * 100).toFixed(0)}% от MEASURED_SECTION_HEIGHT`, async ({
      page,
    }) => {
      const box = await page.locator(`#${section.id}`).boundingBox();
      expect(box, `#${section.id} не найден на странице`).not.toBeNull();
      const measured = MEASURED_SECTION_HEIGHT[section.id];
      expect(measured, `нет записи MEASURED_SECTION_HEIGHT['${section.id}']`).toBeGreaterThan(0);
      const diff = Math.abs(box!.height - measured) / measured;
      expect(
        diff,
        `#${section.id}: реальная высота=${box!.height.toFixed(1)}, MEASURED_SECTION_HEIGHT=${measured}, расхождение=${(diff * 100).toFixed(1)}% (допуск ${(tolerance * 100).toFixed(0)}%)`,
      ).toBeLessThanOrEqual(tolerance);
    });
  }

  test('подвал: реальная высота при 1180 px в пределах 15% от MEASURED_FOOTER_HEIGHT', async ({
    page,
  }) => {
    const box = await page.locator('footer').boundingBox();
    expect(box, 'footer не найден на странице').not.toBeNull();
    const diff = Math.abs(box!.height - MEASURED_FOOTER_HEIGHT) / MEASURED_FOOTER_HEIGHT;
    expect(
      diff,
      `footer: реальная высота=${box!.height.toFixed(1)}, MEASURED_FOOTER_HEIGHT=${MEASURED_FOOTER_HEIGHT}, расхождение=${(diff * 100).toFixed(1)}%`,
    ).toBeLessThanOrEqual(STALENESS_TOLERANCE);
  });
});

test.describe('линия на фоне — сторож устаревания измеренных высот, П-8б (1440 px, вторая таблица)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
  });

  for (const section of HOME_SECTIONS) {
    const has1440 = section.id in MEASURED_SECTION_HEIGHT_1440;
    const label = has1440
      ? `${section.id}: реальная высота при 1440 px в пределах 3% от MEASURED_SECTION_HEIGHT_1440`
      : `${section.id}: реальная высота при 1440 px совпадает с 1180 (MEASURED_SECTION_HEIGHT) в пределах 0,5%`;
    test(label, async ({ page }) => {
      const box = await page.locator(`#${section.id}`).boundingBox();
      expect(box, `#${section.id} не найден на странице`).not.toBeNull();
      if (has1440) {
        const measured = MEASURED_SECTION_HEIGHT_1440[section.id];
        const diff = Math.abs(box!.height - measured) / measured;
        expect(
          diff,
          `#${section.id}: реальная высота=${box!.height.toFixed(1)}, MEASURED_SECTION_HEIGHT_1440=${measured}, расхождение=${(diff * 100).toFixed(1)}%`,
        ).toBeLessThanOrEqual(WIDTH_1440_TOLERANCE);
      } else {
        const measured1180 = MEASURED_SECTION_HEIGHT[section.id];
        expect(measured1180, `нет записи MEASURED_SECTION_HEIGHT['${section.id}']`).toBeGreaterThan(0);
        const diff = Math.abs(box!.height - measured1180) / measured1180;
        expect(
          diff,
          `#${section.id}: не входит в MEASURED_SECTION_HEIGHT_1440, но высота на 1440 (${box!.height.toFixed(1)}) разошлась с 1180 (${measured1180}) на ${(diff * 100).toFixed(2)}% — секция стала зависеть от ширины, заведи для неё запись в MEASURED_SECTION_HEIGHT_1440`,
        ).toBeLessThanOrEqual(WIDTH_MATCH_TOLERANCE);
      }
    });
  }
});

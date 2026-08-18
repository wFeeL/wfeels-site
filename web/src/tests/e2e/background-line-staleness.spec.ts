import { test, expect } from '@playwright/test';
import { HOME_SECTIONS } from '../../lib/sections';
import { MEASURED_FOOTER_HEIGHT, MEASURED_SECTION_HEIGHT } from '../../lib/backgroundLine';

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
 *  падает, если расхождение превышает 15 %.
 *
 *  Порог не строгий (не `±1 px`, как у сторожей самого рисунка, `rail.spec.
 *  ts`): секции главной несут живой текст (заглушки задачи 2 сменятся
 *  настоящей копией, `--stroke-line` и переносы строк слегка гуляют между
 *  сборками), и цель сторожа — поймать РАССОГЛАСОВАНИЕ верстки и таблицы
 *  (перестроили секцию, забыли переизмерить), а не любой суб-пиксельный
 *  дрейф текста. */

const CONTAINER_WIDTH = 1180;
const STALENESS_TOLERANCE = 0.15;

test.describe('линия на фоне — сторож устаревания измеренных высот (раздел 10, шаг 3в)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: CONTAINER_WIDTH, height: 900 });
    await page.goto('/');
  });

  for (const section of HOME_SECTIONS) {
    test(`${section.id}: реальная высота при 1180 px в пределах 15% от MEASURED_SECTION_HEIGHT`, async ({
      page,
    }) => {
      const box = await page.locator(`#${section.id}`).boundingBox();
      expect(box, `#${section.id} не найден на странице`).not.toBeNull();
      const measured = MEASURED_SECTION_HEIGHT[section.id];
      expect(measured, `нет записи MEASURED_SECTION_HEIGHT['${section.id}']`).toBeGreaterThan(0);
      const diff = Math.abs(box!.height - measured) / measured;
      expect(
        diff,
        `#${section.id}: реальная высота=${box!.height.toFixed(1)}, MEASURED_SECTION_HEIGHT=${measured}, расхождение=${(diff * 100).toFixed(1)}%`,
      ).toBeLessThanOrEqual(STALENESS_TOLERANCE);
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

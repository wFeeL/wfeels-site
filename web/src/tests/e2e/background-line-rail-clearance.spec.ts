import { test, expect } from '@playwright/test';

/** Дефект 2, design-ревью 2026-08-19: «линия наезжает на рельс в полосе
 *  1440…1486 px». Причина найдена точно (`BackgroundLine.astro`,
 *  `--line-canvas`): прежний медиазапрос сужал канвас до 1252px только в
 *  диапазоне `1324px…1439px` и обрывался на границе — на 1440px и чуть
 *  выше канвас снова становился полным `min(100vw, 1440px)`, а рельс уже
 *  стоял на месте (появляется с 1324px, `Rail.astro`/`tokens.css`). Просвет
 *  между правым краем краски штриха и левым краем рельса падал ниже
 *  приёмочных 12px (05-line.md, раздел 11, п.13; раздел 6.3, п.3) ровно на
 *  этой полосе (замер design-ревью: −11,5px на 1440px).
 *
 *  Лечение — не расширять полосовой медиазапрос вторым числом (тот же
 *  тип дефекта неизбежен при любой следующей правке контейнера), а считать
 *  просвет НЕПРЕРЫВНОЙ формулой (см. комментарий в `BackgroundLine.astro`):
 *  канвас сужается настолько, насколько нужно для просвета ≥12px (взят
 *  запас до 16px), и сам возвращается к полным 1440px там, где растущее
 *  окно даёт этот запас естественно — без второй границы диапазона.
 *
 *  Сторож меряет ФАКТИЧЕСКУЮ геометрию на живой странице (правый край
 *  прорисованного штриха против левого края `nav.rail`), а не значение
 *  `--line-canvas` — так тест ловит дефект, даже если в будущем изменится
 *  сама формула, толщина штриха или причал.
 *
 *  Секция для замера — `pricing` (раздел 4.3 брифа `05-line`: «прямая,
 *  правый причал» — прямой вертикальный штрих на доке `x=941`, без кривых
 *  рядом, во всю высоту секции, стабильная точка измерения на любой ширине
 *  ≥ 1324px, где рельс уже существует). */

const WIDTHS = [1324, 1440, 1500, 1920];
const MIN_GAP = 12;

test.describe('линия на фоне — просвет до рельса (05-line.md, раздел 11, п.13)', () => {
  for (const width of WIDTHS) {
    test(`${width}px: просвет между краской и рельсом ≥ ${MIN_GAP}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      const geometry = await page.evaluate(() => {
        const section = document.getElementById('pricing');
        const path = section?.querySelector('.line path') as SVGPathElement | null;
        const svg = path?.closest('svg') as SVGSVGElement | null;
        const rail = document.querySelector('nav.rail');
        if (!path || !svg || !rail) return null;

        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const scaleX = vb.width > 0 ? rect.width / vb.width : 1;

        // Причал читается из самого пути (первая координата после `M`), а
        // не берётся константой теста — сторож обязан ловить сдвиг причала
        // так же, как сдвиг формулы канваса.
        const d = path.getAttribute('d') || '';
        const nums = (d.match(/-?\d+\.?\d*/g) || []).map(Number);
        const dockXvb = nums[0];
        const strokeWidthVb = parseFloat(getComputedStyle(path).strokeWidth) || 0;

        const paintRightEdge = rect.left + (dockXvb + strokeWidthVb / 2) * scaleX;
        const railLeftEdge = rail.getBoundingClientRect().left;

        return { paintRightEdge, railLeftEdge, gap: railLeftEdge - paintRightEdge };
      });

      expect(geometry, 'не удалось измерить геометрию линии/рельса на странице').not.toBeNull();
      const { gap, paintRightEdge, railLeftEdge } = geometry!;
      expect(
        gap,
        `просвет ${gap.toFixed(1)}px на ${width}px (краска до ${paintRightEdge.toFixed(1)}, рельс с ${railLeftEdge.toFixed(1)})`,
      ).toBeGreaterThanOrEqual(MIN_GAP);
    });
  }
});

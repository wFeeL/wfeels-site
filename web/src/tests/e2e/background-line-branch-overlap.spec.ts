import { test, expect } from '@playwright/test';
import { LINE_PATHS } from '../../lib/linePaths';
import { flattenPath, parsePath, resampleByLength } from '../../lib/pathGeometry';

/** Сторож П-Я2 — `70-workshop/specs/site-v3/15-line-through-scale-brief.md`,
 *  раздел 6.3/7: «У каждого отвода оформлены оба конца» + «Отвод к стрелке
 *  „Замера“ перекрывает её по y не менее чем на 60% (было 49,7%)».
 *
 *  Находка рецензента, которую закрывает раздел 6.3: ни один отвод не имел
 *  оформленного конца — рождался внутри полосы, до цели не доходил. Пять
 *  отводов к цифрам уже удовлетворяют условию (реестр защищён,
 *  `linePaths.branch.test.ts` проверяет x=112, 11 vb внутри коробки цифры) —
 *  этот файл целиком про ШЕСТОЙ отвод, к стрелке иллюстрации «Замера»
 *  (`#cases .arrow`), единственный, чья геометрия правится разделом 6.3 п.3.
 *
 *  МЕТОД: координаты отвода читаются из `LINE_PATHS.cases.branch` через
 *  `parsePath` (не вписаны в тест числом — та же дисциплина, что уже несёт
 *  `linePaths.branch.test.ts`), переводятся в экранные через
 *  `getScreenCTM()` (тот же приём, что `background-line-trace.spec.ts`
 *  использует для пересечения путей с боксами). «Объединённая высота двух
 *  отрезков стрелки» — раздел 6.1 брифа называет так `#cases .arrow[data-
 *  seg="1"]` и `[data-seg="2"]` вместе (комментарий CSS иллюстрации:
 *  «два отрезка подряд читаются как одна непрерывная стрелка»). */

const WIDTHS = [1180, 1440] as const;

interface OverlapResult {
  vertTop: number;
  vertBottom: number;
  unionTop: number;
  unionBottom: number;
  overlapPx: number;
  pct: number;
  pathEndY: number;
  arrow2Top: number;
  arrow2Bottom: number;
  insideArrow2: boolean;
  marginTopPx: number;
  marginBottomPx: number;
}

async function measureArrowOverlap(page: import('@playwright/test').Page): Promise<OverlapResult> {
  const segments = parsePath(LINE_PATHS.cases.branch!);
  const [, curve, line] = segments; // M, C, L — сторож формы уже в linePaths.branch.test.ts
  if (curve.type !== 'C' || line.type !== 'L') throw new Error('LINE_PATHS.cases.branch разошёлся с ожидаемым M C L');
  const curveEnd = curve.to;
  const pathEnd = line.to;

  return page.evaluate(
    ({ curveEnd, pathEnd }) => {
      const svg = document.querySelector('#cases svg.line') as SVGSVGElement;
      const ctm = svg.getScreenCTM()!;
      const toScreen = (x: number, y: number) => new DOMPoint(x, y).matrixTransform(ctm);
      const a = toScreen(curveEnd.x, curveEnd.y);
      const b = toScreen(pathEnd.x, pathEnd.y);
      const vertTop = Math.min(a.y, b.y);
      const vertBottom = Math.max(a.y, b.y);

      const arrow1 = document.querySelector('#cases .arrow[data-seg="1"]')!.getBoundingClientRect();
      const arrow2 = document.querySelector('#cases .arrow[data-seg="2"]')!.getBoundingClientRect();
      const unionTop = Math.min(arrow1.top, arrow2.top);
      const unionBottom = Math.max(arrow1.bottom, arrow2.bottom);
      const overlapPx = Math.max(0, Math.min(vertBottom, unionBottom) - Math.max(vertTop, unionTop));
      const pct = (overlapPx / (unionBottom - unionTop)) * 100;

      return {
        vertTop,
        vertBottom,
        unionTop,
        unionBottom,
        overlapPx,
        pct,
        pathEndY: b.y,
        arrow2Top: arrow2.top,
        arrow2Bottom: arrow2.bottom,
        insideArrow2: b.y >= arrow2.top && b.y <= arrow2.bottom,
        marginTopPx: b.y - arrow2.top,
        marginBottomPx: arrow2.bottom - b.y,
      };
    },
    { curveEnd, pathEnd },
  );
}

test.describe('П-Я2 — отвод к стрелке «Замера»: оформленный конец, перекрытие ≥ 60% (раздел 6.3 п.3 брифа)', () => {
  for (const width of WIDTHS) {
    test(`${width}×900: перекрытие ≥ 60% объединённой высоты #cases .arrow[data-seg=1]+[2], конец внутри [data-seg=2]`, async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await page.goto('/');
      await page.waitForTimeout(200);

      const r = await measureArrowOverlap(page);
      // eslint-disable-next-line no-console
      console.log(`[П-Я2 @${width}px] перекрытие=${r.pct.toFixed(1)}% (было 49,7% по спеке, до правки этого прогона — 57,3%/58,0%), конец внутри arrow[2]=${r.insideArrow2}, запас до низа коробки=${r.marginBottomPx.toFixed(1)}px, запас от верха=${r.marginTopPx.toFixed(1)}px`);

      expect(r.insideArrow2, `конец отвода (y=${r.pathEndY.toFixed(1)}) обязан лежать внутри #cases .arrow[data-seg="2"] (${r.arrow2Top.toFixed(1)}…${r.arrow2Bottom.toFixed(1)})`).toBe(true);
      expect(r.pct, `перекрытие ${r.pct.toFixed(1)}% ниже порога 60%`).toBeGreaterThanOrEqual(60);

      await ctx.close();
    });
  }
});

test.describe('П-Я2 — начало отвода к стрелке «Замера» лежит внутри краски основной линии (раздел 6.3 п.1)', () => {
  test('рождение (M) лежит не менее чем на 8 vb внутри полуширины штриха (17 vb) основной линии cases', () => {
    const segments = parsePath(LINE_PATHS.cases.branch!);
    const birth = segments[0];
    if (birth.type !== 'M') throw new Error('первый сегмент cases.branch не M');
    const dense = resampleByLength(flattenPath(LINE_PATHS.cases.wide), 2000);
    let nearest = dense[0];
    for (const p of dense) {
      if (Math.abs(p.y - birth.to.y) < Math.abs(nearest.y - birth.to.y)) nearest = p;
    }
    const dxFromCenterline = Math.abs(nearest.x - birth.to.x);
    const HALF_STROKE_VB = 17; // LINE_STROKE_WIDTH_VB / 2 (34/2), раздел 6.3 п.1 брифа
    const insideByVb = HALF_STROKE_VB - dxFromCenterline;
    // eslint-disable-next-line no-console
    console.log(`[П-Я2] рождение отвода cases: Δ от оси основной линии=${dxFromCenterline.toFixed(2)} vb, внутри краски на ${insideByVb.toFixed(2)} vb (нужно ≥ 8)`);
    expect(insideByVb, `рождение отвода внутри краски на ${insideByVb.toFixed(2)} vb, обязано быть ≥ 8`).toBeGreaterThanOrEqual(8);
  });
});

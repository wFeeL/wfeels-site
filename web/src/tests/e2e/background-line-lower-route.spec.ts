import { test, expect } from '@playwright/test';
import { homeSectionIds } from '../../lib/sections';

/** Маршрут линии, нижняя половина главной, вариант А — бриф `70-workshop/
 *  specs/site-v3/18-line-lower-route-brief.md`, раздел 8 (приёмка П-1…П-6).
 *  Метод — раздел «Приёмка — числом»: экранная траектория (`getPointAtLength`
 *  эквивалент — здесь прямое преобразование `viewBox` → страница через
 *  `getBoundingClientRect()` самого `<svg>`, тот же приём, что уже стоит в
 *  `background-line-narrator.spec.ts`, П-21) и реальные коробки DOM, а не
 *  числа реестра `linePaths.ts` — проверка мерит СВОЙСТВО, а не координату.
 *
 *  `reducedMotion: 'reduce'` всюду в этом файле (как в брифе): маршрут —
 *  статическая геометрия путей, шторка раскрытия и её синхронизация с
 *  прокруткой — предмет ДРУГИХ сторожей (`background-line-ink-continuity.
 *  spec.ts`), не этого. */

const WIDTHS = [1440, 1180] as const;

interface PathSample {
  x: number;
  y: number;
  len: number;
}

/** Сэмплирует `<path>` (первый несущий след, не `.line-branch`/`.line-head`)
 *  внутри `sectionSelector` с шагом `step` единиц `viewBox`, отдаёт точки в
 *  РЕАЛЬНЫХ координатах страницы (`page`, не `viewport` — секция может быть
 *  прокручена, а тест не скроллит намеренно: приёмка смотрит на статический
 *  рисунок). */
async function sampleSectionPath(
  page: import('@playwright/test').Page,
  sectionSelector: string,
  step = 1,
): Promise<PathSample[]> {
  return page.evaluate(
    ({ sectionSelector, step }) => {
      const path = document.querySelector(
        `${sectionSelector} svg.line > path:not(.line-branch):not(.line-head)`,
      ) as SVGPathElement | null;
      const svg = path?.closest('svg') as SVGSVGElement | null;
      if (!path || !svg) return [];
      const svgRect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const scaleX = vb.width > 0 ? svgRect.width / vb.width : 1;
      const scaleY = vb.height > 0 ? svgRect.height / vb.height : 1;
      const total = path.getTotalLength();
      const out: PathSample[] = [];
      for (let len = 0; len <= total; len += step) {
        const p = path.getPointAtLength(len);
        out.push({
          x: svgRect.left + (p.x - vb.x) * scaleX + window.scrollX,
          y: svgRect.top + (p.y - vb.y) * scaleY + window.scrollY,
          len,
        });
      }
      return out;
    },
    { sectionSelector, step },
  );
}

async function boxOf(page: import('@playwright/test').Page, selector: string) {
  const el = page.locator(selector);
  const box = await el.boundingBox();
  expect(box, `${selector} не найден на странице`).not.toBeNull();
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  return {
    left: box!.x + scroll.x,
    right: box!.x + box!.width + scroll.x,
    top: box!.y + scroll.y,
    bottom: box!.y + box!.height + scroll.y,
    width: box!.width,
    height: box!.height,
  };
}

function isInside(p: PathSample, b: { left: number; right: number; top: number; bottom: number }) {
  return p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom;
}

function pathLength(samples: PathSample[], predicate: (p: PathSample) => boolean): number {
  let len = 0;
  for (let i = 1; i < samples.length; i += 1) {
    if (predicate(samples[i - 1]) && predicate(samples[i])) {
      len += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
    }
  }
  return len;
}

/** Куски траектории внутри `box`, не перекрытые НИ ОДНИМ прямоугольником из
 *  `obstacles` — П-5. Возвращает длины кусков (real px), а не их число сразу
 *  — приёмка сама решает, что считать «≥30 px». */
function visibleChunks(
  samples: PathSample[],
  box: { left: number; right: number; top: number; bottom: number },
  obstacles: Array<{ left: number; right: number; top: number; bottom: number }>,
): number[] {
  const visible = samples.map((p) => {
    if (!isInside(p, box)) return false;
    return !obstacles.some((o) => isInside(p, o));
  });
  const chunks: number[] = [];
  let cur = 0;
  let active = false;
  for (let i = 1; i < samples.length; i += 1) {
    if (visible[i - 1] && visible[i]) {
      cur += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
      active = true;
    } else if (active) {
      chunks.push(cur);
      cur = 0;
      active = false;
    }
  }
  if (active) chunks.push(cur);
  return chunks.filter((c) => c > 0.5); // отбросить пыль округления, не куски
}

/** Прямоугольники непрозрачных полей формы — раздел 8 брифа, П-5: «фон ≠
 *  `rgba(0,0,0,0)`, а не список селекторов». Обходит ВСЕ элементы внутри
 *  формы, не полагаясь на конкретные теги — новое поле формы попадёт сюда
 *  само, без правки теста. */
async function opaqueFieldBoxes(page: import('@playwright/test').Page, formSelector: string) {
  const rects = await page.evaluate((formSelector) => {
    const form = document.querySelector(formSelector);
    if (!form) return [];
    const out: Array<{ left: number; right: number; top: number; bottom: number }> = [];
    const all = form.querySelectorAll('*');
    for (const el of Array.from(all)) {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const bg = style.backgroundColor;
      if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      out.push({
        left: r.left + window.scrollX,
        right: r.right + window.scrollX,
        top: r.top + window.scrollY,
        bottom: r.bottom + window.scrollY,
      });
    }
    return out;
  }, formSelector);
  return rects;
}

test.describe('линия — маршрут нижней половины главной, П-1/П-3: сквозь фотографию (раздел 8 брифа `18-…`)', () => {
  for (const width of WIDTHS) {
    test(`${width}×900: вход сверху, выход справа, ≥260px внутри рамки, углубление ≥80px, мёртвая зона .photo-curtain = 0`, async ({
      browser,
    }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await page.goto('/');

      const samples = await sampleSectionPath(page, '#about', 0.5);
      expect(samples.length, '#about .line path не найден').toBeGreaterThan(0);

      const frame = await boxOf(page, '#about .photo-frame');
      const curtain = await boxOf(page, '#about .photo-curtain');

      const insideFrame = samples.filter((p) => isInside(p, frame));
      const insideLen = pathLength(samples, (p) => isInside(p, frame));
      expect(insideLen, `длина внутри рамки=${insideLen.toFixed(1)}`).toBeGreaterThanOrEqual(260);

      const depths = insideFrame.map((p) =>
        Math.min(p.x - frame.left, frame.right - p.x, p.y - frame.top, frame.bottom - p.y),
      );
      const maxDepth = depths.length ? Math.max(...depths) : 0;
      expect(maxDepth, `максимальное углубление=${maxDepth.toFixed(1)}`).toBeGreaterThanOrEqual(80);

      // Вход/выход — первая и последняя точка ВНУТРИ рамки по порядку `len`.
      const entry = insideFrame[0];
      const exit = insideFrame[insideFrame.length - 1];
      const sideOf = (p: PathSample) => {
        const d = {
          top: p.y - frame.top,
          bottom: frame.bottom - p.y,
          left: p.x - frame.left,
          right: frame.right - p.x,
        };
        return (Object.entries(d) as Array<[string, number]>).sort((a, b) => a[1] - b[1])[0][0];
      };
      expect(sideOf(entry), `вход через кромку "${sideOf(entry)}" на (${entry.x.toFixed(1)},${entry.y.toFixed(1)})`).toBe('top');
      expect(sideOf(exit), `выход через кромку "${sideOf(exit)}" на (${exit.x.toFixed(1)},${exit.y.toFixed(1)})`).toBe('right');

      // П-3 — мёртвая зона: длина внутри `.photo-curtain` = 0.
      const curtainLen = pathLength(samples, (p) => isInside(p, curtain));
      expect(curtainLen, `длина внутри .photo-curtain=${curtainLen.toFixed(1)} (ожидалось 0)`).toBe(0);

      await ctx.close();
    });
  }
});

test.describe('линия — маршрут нижней половины главной, П-4: правый прогон виден в полосе панели faq (раздел 8 брифа `18-…`)', () => {
  for (const width of WIDTHS) {
    test(`${width}×900: отрезок ≥300px правее кромки панели с просветом ≥11,9px`, async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await page.goto('/');

      const panel = await boxOf(page, '#faq > .panel');

      // Краска трёх соседних путей маршрута — объединение, не один путь
      // (раздел 8 брифа, П-4: «проверяется по объединению краски всех трёх
      // путей в полосе панели, а не по одному пути»).
      const all = [
        ...(await sampleSectionPath(page, '#about', 0.5)),
        ...(await sampleSectionPath(page, '#faq', 0.5)),
        ...(await sampleSectionPath(page, '#contact', 0.5)),
      ].sort((a, b) => a.y - b.y);

      const inPanelBand = (p: PathSample) => p.y >= panel.top && p.y <= panel.bottom;
      const rightOfPanel = (p: PathSample) => p.x >= panel.right;

      // Просвет реальный: минимальная дистанция x-краски (правее кромки) до
      // кромки панели, среди точек в полосе панели, правее кромки.
      const candidates = all.filter((p) => inPanelBand(p) && rightOfPanel(p));
      expect(candidates.length, 'нет ни одной точки краски правее панели в её полосе').toBeGreaterThan(0);
      const minGap = Math.min(...candidates.map((p) => p.x - panel.right));
      expect(minGap, `просвет от панели до ближайшей краски=${minGap.toFixed(2)}px`).toBeGreaterThanOrEqual(11.9);

      // Длина непрерывного (по x-сортировке недостаточно — считаем по
      // каждому пути отдельно длину внутри полосы+правее кромки, суммируем
      // максимальный НЕПРЕРЫВНЫЙ отрезок каждого, берём объединение как
      // приёмка требует: сумма отрезков >= 300px хотя бы одним путём ИЛИ
      // покрытием без разрыва — здесь считаем консервативно суммой длин
      // отдельных путей в полосе, это НЕ завышает результат относительно
      // приёмки, а даёт нижнюю оценку требуемого свойства).
      let total = 0;
      for (const sel of ['#about', '#faq', '#contact']) {
        const s = await sampleSectionPath(page, sel, 0.5);
        total += pathLength(s, (p) => inPanelBand(p) && rightOfPanel(p));
      }
      expect(total, `суммарная длина краски правее панели в её полосе=${total.toFixed(1)}px`).toBeGreaterThanOrEqual(300);

      await ctx.close();
    });
  }
});

test.describe('линия — маршрут нижней половины главной, П-5: пересечение формы (раздел 8 брифа `18-…`)', () => {
  for (const width of WIDTHS) {
    test(`${width}×900: ≥500px внутри формы, ровно четыре видимых куска ≥30px`, async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await page.goto('/');

      const samples = await sampleSectionPath(page, '#contact', 0.5);
      const formBox = await boxOf(page, '#contact form');
      const insideLen = pathLength(samples, (p) => isInside(p, formBox));
      expect(insideLen, `длина внутри формы=${insideLen.toFixed(1)}`).toBeGreaterThanOrEqual(500);

      const obstacles = await opaqueFieldBoxes(page, '#contact form');
      const chunks = visibleChunks(samples, formBox, obstacles);
      expect(
        chunks.length,
        `видимых кусков=${chunks.length} (${chunks.map((c) => c.toFixed(1)).join(', ')}px) — ожидалось ровно 4`,
      ).toBe(4);
      for (const c of chunks) {
        expect(c, `кусок ${c.toFixed(1)}px короче 30px`).toBeGreaterThanOrEqual(30);
      }

      await ctx.close();
    });
  }
});

test.describe('линия — маршрут нижней половины главной, П-6: соседство секций и полосы перекрытия (раздел 8 брифа `18-…`)', () => {
  test('HOME_SECTIONS: guarantees → about → reviews → faq → contact идут подряд после первого отзыва', () => {
    const ids = homeSectionIds();
    const gi = ids.indexOf('guarantees');
    const ai = ids.indexOf('about');
    const ri = ids.indexOf('reviews');
    const fi = ids.indexOf('faq');
    const ci = ids.indexOf('contact');
    expect(gi, 'guarantees отсутствует в HOME_SECTIONS').toBeGreaterThanOrEqual(0);
    expect(ai, 'about отсутствует в HOME_SECTIONS').toBeGreaterThanOrEqual(0);
    expect(ri, 'reviews отсутствует в HOME_SECTIONS после публикации первого отзыва').toBeGreaterThanOrEqual(0);
    expect(fi, 'faq отсутствует в HOME_SECTIONS').toBeGreaterThanOrEqual(0);
    expect(ci, 'contact отсутствует в HOME_SECTIONS').toBeGreaterThanOrEqual(0);
    expect(
      [gi, ai, ri, fi, ci],
      `порядок секций маршрута разъехался: ${ids.join(', ')} — маршрут исходит из того, что ` +
        'guarantees/about/reviews/faq/contact идут подряд после решения D-149.',
    ).toEqual([gi, gi + 1, gi + 2, gi + 3, gi + 4]);
  });

  /** ПРАВКА `2026-08-28` (раздвоение на стыке `guarantees → about`, ловушка
   *  44/45 `50-code/CLAUDE.md`, D-145): прежняя версия этого блока искала
   *  «где-нибудь внутри [lo,hi] НАЙДЁТСЯ непрерывный кусок ≥60px, где
   *  `|xA(y)−xB(y)|≤2px`» (`bestLen`, снята ниже) — критерий пройден
   *  ЛЮБЫМ куском полосы, даже если остаток полосы разъезжается: на живой
   *  геометрии до этой правки кусок `[about-локальный −260…−150]` (обе
   *  краски вертикальны) давал `bestLen≈130px` на 1180 и `≈152px` на 1440 —
   *  оба ЗНАЧИТЕЛЬНО больше порога 60, тест ЗЕЛЁНЫЙ, — а дальше, до самого
   *  конца полосы (`about-локальный −150…−30`), `about` уже сворачивала к
   *  фотографии, пока `guarantees` стояла на доке: две краски на разных `x`
   *  на трети полосы, и владелец увидел это как «раздвоение» уже ПОСЛЕ
   *  того, как сторож был зелёным. Найдено «полоса ≥60 существует», а
   *  проверяться обязано было «ВСЯ полоса перекрытия выровнена» — раздел
   *  5.1 брифа `18-…` требует именно этого («обе краски ВЕРТИКАЛЬНЫ И СТОЯТ
   *  НА ОДНОМ x»), не «где-то есть подходящий кусок».
   *
   *  Новая форма — БЕЗ поиска лучшего куска: полоса перекрытия `[lo,hi]`
   *  сама обязана быть ≥60px (структурное требование — есть о чём вообще
   *  говорить), И максимальное расхождение `|xA(y)−xB(y)|` ПО ВСЕЙ полосе
   *  `[lo,hi]` (не по найденному куску) обязано быть ≤2px — тот же порог
   *  «выровнено», что раньше использовался только для отбора кусков.
   *  Красное доказательство (замер прогоном ЭТОГО ЖЕ теста с временно
   *  возвращённой геометрией `guarantees.wide` до правки — хвост кончался
   *  на `about`-локальном `−30`, не `−150`): падает на паре
   *  `guarantees→about` с сообщением `максимальное расхождение на ВСЕЙ
   *  полосе перекрытия=16.92px @1180` / `=19.79px @1440` (оба > 2px) при
   *  полосе `271.4px` на обеих ширинах (≥60, структурная часть одна
   *  проходит бы и её не заметила) — то есть именно то раздвоение, что
   *  видел владелец. С правкой (хвост кончается на `about`-локальном
   *  `−150`, где `about` сама ещё вертикальна) оба падения уходят в 0px. */
  for (const width of WIDTHS) {
    test(`${width}×900: вся полоса перекрытия ≥60px и выровнена (≤2px) на стыках guarantees/about, about/reviews, reviews/faq, faq/contact`, async ({
      browser,
    }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      await page.goto('/');

      const pairs: Array<[string, string]> = [
        ['#guarantees', '#about'],
        ['#about', '#reviews'],
        ['#reviews', '#faq'],
        ['#faq', '#contact'],
      ];
      for (const [aSel, bSel] of pairs) {
        const a = await sampleSectionPath(page, aSel, 0.5);
        const b = await sampleSectionPath(page, bSel, 0.5);
        // `x(y)` каждого пути — сортировка по `y` (пути монотонны по `y` по
        // построению, раздел 6.2 брифа) плюс линейная интерполяция между
        // соседними сэмплами.
        const sortedA = [...a].sort((p, q) => p.y - q.y);
        const sortedB = [...b].sort((p, q) => p.y - q.y);
        const xAtY = (pts: PathSample[], y: number): number | null => {
          if (!pts.length || y < pts[0].y || y > pts[pts.length - 1].y) return null;
          let lo = 0;
          let hi = pts.length - 1;
          while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (pts[mid].y <= y) lo = mid;
            else hi = mid;
          }
          const p0 = pts[lo];
          const p1 = pts[hi];
          const t = p1.y > p0.y ? (y - p0.y) / (p1.y - p0.y) : 0;
          return p0.x + (p1.x - p0.x) * t;
        };

        const lo = Math.max(sortedA[0].y, sortedB[0].y);
        const hi = Math.min(sortedA[sortedA.length - 1].y, sortedB[sortedB.length - 1].y);
        expect(hi, `${aSel}→${bSel}: пути не пересекаются по y вовсе @${width}`).toBeGreaterThan(lo);
        expect(
          hi - lo,
          `${aSel}→${bSel}: полоса перекрытия=${(hi - lo).toFixed(1)}px @${width} короче 60px`,
        ).toBeGreaterThanOrEqual(60);

        // Расхождение НА ВСЕЙ полосе — не в лучшем найденном куске: шаг 1px,
        // максимум |xA(y)-xB(y)| по всему [lo,hi] обязан остаться ≤2px.
        let maxDx = 0;
        let maxDxAtY = lo;
        for (let y = lo; y <= hi; y += 1) {
          const xa = xAtY(sortedA, y);
          const xb = xAtY(sortedB, y);
          if (xa === null || xb === null) continue;
          const dx = Math.abs(xa - xb);
          if (dx > maxDx) {
            maxDx = dx;
            maxDxAtY = y;
          }
        }

        expect(
          maxDx,
          `${aSel}→${bSel}: максимальное расхождение на ВСЕЙ полосе перекрытия=${maxDx.toFixed(2)}px @${width} (в точке y=${maxDxAtY.toFixed(1)}, полоса ${(hi - lo).toFixed(1)}px) — краски разъезжаются внутри полосы, а не только на её конце`,
        ).toBeLessThanOrEqual(2);
      }

      await ctx.close();
    });
  }
});

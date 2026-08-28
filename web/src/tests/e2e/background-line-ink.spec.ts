import { test, expect } from '@playwright/test';
import { LINE_PATHS } from '../../lib/linePaths';
import { homeReviews } from '../../data/reviews';

/** Тест «чернил» — бриф `70-workshop/specs/site-v3/05-line.md`, раздел 1.1
 *  и раздел 10, шаг 1.
 *
 *  Замер владельца показал, что действующая связка `pathLength="1"` +
 *  `stroke-dasharray: 1 1` + `vector-effect: non-scaling-stroke` красит
 *  только долю `1 / max(scaleX, scaleY)` коробки элемента — остаток пути
 *  НИКОГДА не получает краски, вне зависимости от прокрутки и анимации.
 *  Ни один из существующих сторожей (`background-line.spec.ts`) этого не
 *  ловит, потому что все они меряют `stroke-dashoffset` (прогресс
 *  анимации), а не то, что фактически закрашено пикселем.
 *
 *  Приём (раздел 10, шаг 1): в `page.evaluate` клонировать каждый `<path>`
 *  линии, перенести на клон ВЫЧИСЛЕННЫЕ `stroke-*`, обернуть в свежий
 *  `<svg>` с тем же `viewBox` и preserveAspectRatio="none", но
 *  дополненным полями бокса (`getBBox()`) — иначе конец пути, специально
 *  вынесенный за исходный `viewBox` (раздел 3.6 брифа `02-background-line`),
 *  окажется вне кадра захвата и тест соврёт. Пиксельный масштаб (px на
 *  единицу `viewBox`) синтетического SVG подобран РАВНЫМ масштабу
 *  реального бокса на странице (`rect.width / vb.width`,
 *  `rect.height / vb.height`) — это то самое `scaleX`/`scaleY` из раздела
 *  1.1, и без точного совпадения `vector-effect: non-scaling-stroke`
 *  ведёт себя иначе, чем в реальном рендере. Сериализуется
 *  `XMLSerializer`, грузится как `data:`-URL в `Image`, рисуется в
 *  `<canvas>`; пиксели читаются в круге радиуса `2·w` вокруг
 *  `getPointAtLength(L)` — КОНЦА пути. Утверждение: у конца каждого пути
 *  есть непрозрачный пиксель (alpha > 10).
 *
 *  Ловушка раздела 12, пункт 7: `getComputedStyle(path).strokeDasharray`
 *  возвращает сериализацию CSSOM («1px, 1px»), а не то, как путь красится.
 *  Единственный честный способ — прочитать пиксели, что этот тест и
 *  делает; вычисленные стили переносятся на клон буквально, без
 *  интерпретации их смысла.
 *
 *  ВНИМАНИЕ будущему правщику: этот тест — сторож ФИЗИКИ рисования, а не
 *  конкретной геометрии путей. Он обязан оставаться зелёным и после того,
 *  как раздел 10 шага 4 перерисует все одиннадцать путей заново — тест не
 *  знает форму `d`, только то, что её конец закрашен. */

const LINE_PATH_SELECTOR = '.line path';

interface InkResult {
  label: string;
  hasInk: boolean;
  px: number;
  py: number;
  canvasW: number;
  canvasH: number;
}

async function measureInkAtPathEnds(page: import('@playwright/test').Page): Promise<InkResult[]> {
  return page.evaluate(async (sel) => {
    const paths = Array.from(document.querySelectorAll(sel)) as SVGPathElement[];
    const results: {
      label: string;
      hasInk: boolean;
      px: number;
      py: number;
      canvasW: number;
      canvasH: number;
    }[] = [];

    for (const path of paths) {
      const svg = path.closest('svg') as SVGSVGElement | null;
      if (!svg) continue;

      const owner = path.closest('[data-line-side], footer, section') as HTMLElement | null;
      const ownerId = owner?.id || owner?.tagName.toLowerCase() || 'unknown';
      const kind = svg.classList.contains('line-turn')
        ? 'turn'
        : svg.classList.contains('line-run')
          ? 'run'
          : 'line';
      const label = `${ownerId}:${kind}`;

      const rect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      // Реальный масштаб КОРОБКИ на странице — то самое scaleX/scaleY
      // раздела 1.1. Синтетический SVG обязан красить с тем же масштабом,
      // иначе non-scaling-stroke ведёт себя иначе, чем в браузере.
      const realScaleX = vb.width > 0 ? rect.width / vb.width : 1;
      const realScaleY = vb.height > 0 ? rect.height / vb.height : 1;

      const style = getComputedStyle(path);
      const bbox = path.getBBox();
      const strokeWidthRaw = parseFloat(style.strokeWidth) || 1;
      // Запас вокруг геометрии пути, включая часть, вынесенную за исходный
      // viewBox (раздел 3.6) — иначе конец пути, который и является
      // предметом теста, окажется за пределами кадра захвата.
      const pad = strokeWidthRaw * 3 + 40;
      const vbX = bbox.x - pad;
      const vbY = bbox.y - pad;
      const vbW = Math.max(1, bbox.width + pad * 2);
      const vbH = Math.max(1, bbox.height + pad * 2);

      const canvasW = Math.max(1, Math.round(vbW * realScaleX));
      const canvasH = Math.max(1, Math.round(vbH * realScaleY));

      // Клин `hero` (`path.line-head`, раздел 12.4 брифа `11-line-
      // narrator-brief.md`, решение «клин делаем», 12.1 В-1) — вторая
      // заливаемая фигура в коробке `hero`: красится `fill`, а `stroke:
      // none` — «у <path> нет сужающегося пера в обводке» (комментарий
      // `BackgroundLine.astro`, К-7). Было: клон всегда получал
      // `fill="none"` — годилось, пока в реестре не было ни одной
      // заливаемой фигуры, и красящий канал у любого `.line path` был
      // только `stroke`. Стало: канал определяется по вычисленным стилям
      // самого пути, а не предполагается — фигура с `stroke: none` и
      // непустым `fill` копирует ЗАЛИВКУ на клон, а не обводку; обратное
      // (обычный путь линии) ведёт себя как раньше, без изменений.
      const usesFill = style.stroke === 'none' && style.fill !== 'none';

      const clone = path.cloneNode(false) as SVGPathElement;
      clone.removeAttribute('class');
      clone.setAttribute('stroke', usesFill ? 'none' : style.stroke);
      clone.setAttribute('stroke-opacity', style.strokeOpacity);
      clone.setAttribute('stroke-width', style.strokeWidth);
      clone.setAttribute('stroke-dasharray', style.strokeDasharray);
      clone.setAttribute('stroke-dashoffset', style.strokeDashoffset);
      clone.setAttribute('stroke-linecap', style.strokeLinecap);
      clone.setAttribute('stroke-linejoin', style.strokeLinejoin);
      clone.setAttribute('vector-effect', style.vectorEffect);
      clone.setAttribute('fill', usesFill ? style.fill : 'none');
      clone.setAttribute('fill-opacity', usesFill ? style.fillOpacity : '0');
      const pathLengthAttr = path.getAttribute('pathLength');
      if (pathLengthAttr) clone.setAttribute('pathLength', pathLengthAttr);

      const newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      newSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      newSvg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
      newSvg.setAttribute('preserveAspectRatio', 'none');
      newSvg.setAttribute('width', String(canvasW));
      newSvg.setAttribute('height', String(canvasH));
      newSvg.setAttribute('overflow', 'visible');
      newSvg.appendChild(clone);

      const xml = new XMLSerializer().serializeToString(newSvg);
      const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(xml)))}`;

      const img = new Image();
      img.width = canvasW;
      img.height = canvasH;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`не удалось загрузить синтетический svg для ${label}`));
        img.src = dataUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvasW, canvasH);

      const L = path.getTotalLength();
      const end = path.getPointAtLength(L);
      const px = Math.round((end.x - vbX) * realScaleX);
      const py = Math.round((end.y - vbY) * realScaleY);

      // Радиус выборки — 2·w в РЕАЛЬНЫХ экранных пикселях (раздел 10, шаг
      // 1): для non-scaling-stroke толщина на экране равна сырому
      // значению stroke-width; для масштабируемого штриха — значению,
      // помноженному на масштаб коробки.
      const renderedStrokePx =
        style.vectorEffect === 'non-scaling-stroke'
          ? strokeWidthRaw
          : strokeWidthRaw * Math.max(realScaleX, realScaleY);
      const radius = Math.max(6, Math.round(2 * renderedStrokePx));

      const x0 = Math.max(0, px - radius);
      const y0 = Math.max(0, py - radius);
      const x1 = Math.min(canvasW, px + radius);
      const y1 = Math.min(canvasH, py + radius);
      let hasInk = false;
      if (x1 > x0 && y1 > y0) {
        const data = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 10) {
            hasInk = true;
            break;
          }
        }
      }

      results.push({ label, hasInk, px, py, canvasW, canvasH });
    }

    return results;
  }, LINE_PATH_SELECTOR);
}

test.describe('линия на фоне — тест чернил (05-line.md, раздел 1.1 и шаг 1)', () => {
  test('у конца каждого пути линии есть краска', async ({ browser }) => {
    // `reducedMotion: 'reduce'` — конечное состояние («нарисовано целиком»,
    // `stroke-dashoffset: 0`) — состояние ПО УМОЛЧАНИЮ (раздел 7.5 брифа
    // `02-background-line`, раздел 12 п. 5 брифа `05-line`). Именно это
    // состояние владелец проверял прямым опытом (раздел 1.1: «конечное
    // состояние `stroke-dashoffset: 0`, то есть „нарисовано целиком“»).
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('/');

    const results = await measureInkAtPathEnds(page);
    // Число путей на странице не вписано числом: на каждую запись реестра
    // (после решения В-4, раздел 12.1 брифа `11-line-narrator-brief.md`,
    // запись `footer` снята — секций 10, без «хвоста подвала») запись может
    // нести клин `.line-head` (раздел 12.4 брифа — `LINE_PATHS.hero.head`,
    // второй `<path>` в той же коробке, заливаемой фигурой; сегодня это
    // только `hero`, но число выводится из реестра, а не переписывается
    // руками на каждый новый `.head`). Число клиньев растёт независимо от
    // числа секций — ожидание выводится из самого реестра (ловушки 15/21/24,
    // `50-code/CLAUDE.md`).
    //
    // ПРАВКА `2026-08-28`: поле `branch` (`.line-branch`, второй путь того
    // же рода) СНЯТО целиком из `LinePathEntry` — прямое указание владельца,
    // последний оставшийся отвод (`cases`) читался на снимке как случайная
    // линейка. Слагаемое `branchCount` снято из формулы вместе с полем, а
    // не оставлено считать вечный ноль.
    //
    // `reviews` — исключение, поимённое (`70-workshop/specs/site-v3/
    // 14-reviews-brief.md`, раздел 4.2): запись реестра заведена БЕЗУСЛОВНО,
    // а секция на странице существует только когда `homeReviews().length >
    // 0` (`lib/sections.ts`). Читается тем же условием, а не вписывается
    // числом руками — в день, когда владелец подставит первый отзыв, эта
    // строка сама включит запись обратно в ожидаемое число вместо того,
    // чтобы красить тест до следующей правки.
    const OPTIONAL_CONSUMER_ENTRIES = new Set(['reviews']);
    const hasOptionalConsumer = homeReviews().length > 0;
    const registryKeys = Object.keys(LINE_PATHS).filter(
      (id) => hasOptionalConsumer || !OPTIONAL_CONSUMER_ENTRIES.has(id),
    );
    const headCount = registryKeys.filter((id) => Boolean(LINE_PATHS[id].head)).length;
    const expectedPathCount = registryKeys.length + headCount;
    expect(
      results.length,
      `на странице должно быть ${expectedPathCount} путей линии: ${registryKeys.length} записей ` +
      `реестра (секции) + ${headCount} со своим .line-head`,
    ).toBe(expectedPathCount);

    const failing = results.filter((r) => !r.hasInk);
    const report = failing
      .map((r) => `${r.label} (конец на ${r.px},${r.py} в канвасе ${r.canvasW}×${r.canvasH})`)
      .join('; ');
    expect(failing, `у конца пути нет краски: ${report}`).toEqual([]);

    await ctx.close();
  });
});

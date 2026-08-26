import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Общий измеритель «заполнения панели» — сторож 10.1
 * `70-workshop/specs/site-v3/12-case-pages-brief.md`.
 *
 * Первая редакция мерила union bbox ВИДИМЫХ ПРЯМЫХ ПОТОМКОВ панели и давала
 * 100,0 % у всех трёх панелей прототипа `/dev/case/v`, включая ту, из-за
 * которой владелец забраковал вариант («не нравятся как будто пустые
 * схемы») — причина: внутри панели стоит обёртка-`div` во всю панель, её
 * bbox равен панели, и старое правило видело именно её. Правило переписано
 * на габарит КРАСКИ (D-120): в объединение попадают только листовые узлы, а
 * обёртка с детьми не входит в него никогда.
 *
 * «Объединение» здесь — это ограничивающий прямоугольник (min/max по всем
 * собранным боксам), а не площадь теоретико-множественного объединения с
 * учётом перекрытий: числа брифа воспроизводятся только при таком чтении
 * (три чипа в ряд дают одну общую полосу 300,9 × 40,4, а не сумму трёх
 * маленьких прямоугольников).
 */

/** Порог заполнения — 60 %.
 *
 * Вывод (раздел 10.1.2 брифа): панель со схемой несёт внутренний отступ
 * 32 px при полосе 702 px → поле рисунка 638 px = 90,9 % ширины панели; от
 * рисунка требуется занять не меньше 70 % высоты (П-3) → нижняя граница по
 * устройству 0,909 × 0,70 = 63,6 %. Порог опущен до 60 % как допуск на
 * скругления, подписи и округление — и не ниже: 60 % лежит выше любой
 * забракованной панели (максимум ~51,6 % на прототипе) и ниже любой живой
 * панели с настоящим кадром (минимум ~72,4 % на галерее витрин).
 *
 * Порог НЕ ослабляется, если живая панель однажды даст красный — это
 * находка о панели, а не повод поднять число (инвариант брифа).
 */
export const PAINT_FILL_THRESHOLD = 0.6;

/** Для схемы (не фотографии) требования П-3 строже и раздельные по осям:
 *  не меньше 70 % ширины и 60 % высоты поля. */
export const SCHEMA_MIN_WIDTH_RATIO = 0.7;
export const SCHEMA_MIN_HEIGHT_RATIO = 0.6;

/** Для панели со снимком — ширина `<img>` не меньше 95 % ширины панели. */
export const PHOTO_MIN_IMG_WIDTH_RATIO = 0.95;

export interface FillResult {
  ratio: number;
  paintArea: number;
  panelArea: number;
  paintWidth: number;
  paintHeight: number;
  leafCount: number;
}

/** Габарит краски (З-2). Передаётся напрямую в `locator.evaluate` —
 *  функция не замыкает ничего снаружи и не рассчитана на вызов из Node,
 *  только из браузера.
 *
 *  Обход: элемент БЕЗ элементов-детей — атомарный лист, его собственный
 *  `getBoundingClientRect()` уже несёт всю его краску (текст и паспарту не
 *  различаются нарочно — красит один и тот же узел). Голый текстовый узел,
 *  висящий рядом с дочерними элементами («Привет, <b>мир</b>»), меряется
 *  отдельно через `Range`, потому что у текстового узла своего
 *  `getBoundingClientRect()` нет. `<svg>` — всегда атомарный узел независимо
 *  от количества внутренних `<path>`/`<rect>`: `getBBox()` уже возвращает
 *  объединение его собственного содержимого, переводится в CSS-пиксели
 *  через `viewBox`. Узел с детьми-элементами сам никогда не входит в
 *  объединение — это и есть исправление D-120: раньше в объединение
 *  попадала как раз такая обёртка. */
export function measurePaintFill(panel: Element): FillResult {
  const panelRect = panel.getBoundingClientRect();
  const panelArea = panelRect.width * panelRect.height;

  type Box = { left: number; top: number; right: number; bottom: number };
  const boxes: Box[] = [];

  function isHidden(el: Element): boolean {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return true;
    const opacity = Number.parseFloat(cs.opacity);
    return Number.isFinite(opacity) && opacity === 0;
  }

  function pushRect(rect: { left: number; top: number; right: number; bottom: number }) {
    const width = rect.right - rect.left;
    const height = rect.bottom - rect.top;
    if (width > 0 && height > 0) {
      boxes.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
    }
  }

  function pushSvg(svg: SVGSVGElement) {
    const svgRect = svg.getBoundingClientRect();
    const vb = svg.viewBox && svg.viewBox.baseVal;
    if (!vb || vb.width === 0 || vb.height === 0) {
      // Нет viewBox — переводить не из чего, берётся собственный бокс.
      pushRect(svgRect);
      return;
    }
    let bbox: SVGRect;
    try {
      bbox = svg.getBBox();
    } catch {
      return;
    }
    if (!bbox || bbox.width <= 0 || bbox.height <= 0) return;
    const scaleX = svgRect.width / vb.width;
    const scaleY = svgRect.height / vb.height;
    const left = svgRect.left + (bbox.x - vb.x) * scaleX;
    const top = svgRect.top + (bbox.y - vb.y) * scaleY;
    pushRect({
      left,
      top,
      right: left + bbox.width * scaleX,
      bottom: top + bbox.height * scaleY,
    });
  }

  function walk(node: Element) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent;
        if (!text || !text.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(child);
        pushRect(range.getBoundingClientRect());
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as Element;
      if (isHidden(el)) continue; // раздел 10.1.1, пункт 3 — скрытый узел не входит и не обходится глубже
      if (el.tagName.toLowerCase() === 'svg') {
        pushSvg(el as unknown as SVGSVGElement);
        continue; // внутрь svg не спускаемся — getBBox уже даёт объединение
      }
      if (el.children.length === 0) {
        pushRect(el.getBoundingClientRect()); // атомарный лист
        continue;
      }
      walk(el); // узел с детьми — сам не считается, спускаемся глубже
    }
  }

  walk(panel);

  if (boxes.length === 0 || panelArea <= 0) {
    return { ratio: 0, paintArea: 0, panelArea, paintWidth: 0, paintHeight: 0, leafCount: boxes.length };
  }

  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  const right = Math.max(...boxes.map((b) => b.right));
  const bottom = Math.max(...boxes.map((b) => b.bottom));
  const paintWidth = right - left;
  const paintHeight = bottom - top;
  const paintArea = paintWidth * paintHeight;

  return { ratio: paintArea / panelArea, paintArea, panelArea, paintWidth, paintHeight, leafCount: boxes.length };
}

/** Старое правило (правило А, отвергнутое D-120): union bbox ВИДИМЫХ ПРЯМЫХ
 *  потомков панели, без спуска вглубь. Оставлено только как измеритель для
 *  доказательства контраста «было / стало» (раздел 10.1.5 брифа) — сторожем
 *  не является и нигде, кроме доказательства, не используется. */
export function measureLegacyDirectChildBbox(panel: Element): FillResult {
  const panelRect = panel.getBoundingClientRect();
  const panelArea = panelRect.width * panelRect.height;

  function isVisible(el: Element): boolean {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const opacity = Number.parseFloat(cs.opacity);
    if (Number.isFinite(opacity) && opacity === 0) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  const rects = Array.from(panel.children).filter(isVisible).map((el) => el.getBoundingClientRect());
  if (rects.length === 0 || panelArea <= 0) {
    return { ratio: 0, paintArea: 0, panelArea, paintWidth: 0, paintHeight: 0, leafCount: rects.length };
  }
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  const paintWidth = right - left;
  const paintHeight = bottom - top;
  const paintArea = paintWidth * paintHeight;
  return { ratio: paintArea / panelArea, paintArea, panelArea, paintWidth, paintHeight, leafCount: rects.length };
}

/** Число `<svg>`-узлов в панели НЕЗАВИСИМО от видимости — `querySelectorAll`
 *  не смотрит на `display`/`visibility`. Схема обязана нести ровно одну
 *  копию разметки (раздел 2 брифа, «Схема обязана иметь ОДНУ копию
 *  разметки»); две копии под разные ширины, из которых одна всегда `display:
 *  none`, — запрещены, это и есть исторический баг Б-1 (раздел 0.1 брифа). */
export function countSvgCopies(panel: Element): number {
  return panel.querySelectorAll('svg').length;
}

/* --- Список страниц выводится из сборки, а не вписывается руками ---------
 *
 * Ловушка 15/21 (`50-code/CLAUDE.md`): рукописный список объектов проверки
 * стареет молча в день, когда объектов становится больше. На сайте сегодня
 * 29 страниц, не 24, — число, которое рукописный список почти наверняка
 * унёс бы неверным. Тот же приём, что уже применяет `case-weight-load-
 * time.spec.ts` и `illustrationRoute.ts`: страницы ищутся в `dist/` по
 * присутствию машинного признака, а не перечисляются.
 */
const DIST = fileURLToPath(new URL('../../../dist/', import.meta.url));

function htmlFiles(dir: string, base = dir): string[] {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    if (entry.name === '_astro') return [];
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full, base);
    return entry.name.endsWith('.html') ? [relative(base, full)] : [];
  });
}

function urlFromHtmlFile(relPath: string): string {
  const posix = relPath.split(sep).join('/');
  if (posix === 'index.html') return '/';
  if (posix.endsWith('/index.html')) return `/${posix.slice(0, -'/index.html'.length)}`;
  return `/${posix.replace(/\.html$/, '')}`;
}

/** Страницы кейсов (русские и английские зеркала), выведенные из фактически
 *  собранного `dist/`. Сегодня возвращает пять `/cases/<slug>` и пять
 *  `/en/cases/<slug>` — ровно те, что публикует `publishedCases()`; список
 *  пересчитывается сам, если публикуемых кейсов станет больше или меньше. */
export function distCasePages(): string[] {
  if (!existsSync(DIST)) return [];
  return htmlFiles(DIST)
    .map(urlFromHtmlFile)
    .filter((url) => /^\/(en\/)?cases\/[^/]+$/.test(url))
    .sort();
}

export function distExists(): boolean {
  return existsSync(DIST);
}

export function readDistHtml(url: string): string | null {
  const path = url === '/' ? 'index.html' : `${url.replace(/^\//, '')}/index.html`;
  const full = join(DIST, path);
  if (!existsSync(full)) return null;
  return readFileSync(full, 'utf8');
}

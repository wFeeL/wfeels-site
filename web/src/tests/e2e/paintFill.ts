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

/** Верхняя граница заполнения — 101 %.
 *
 * Найдено на трио-раскладке разворота `zayavka-hub` (панель 2/4, ширина
 * 390 px): до обрезки боксов по клипующим предкам (см. комментарий над
 * `measurePaintFill`) заполнение доходило до 308,9 % — габарит краски
 * считал содержимое горизонтальной ленты `overflow-x: auto`, которое
 * НАРОЧНО лежит за пределами видимой полосы (раздел 3.3 брифа
 * `12-case-pages-brief.md`: следующий кадр «выглядывает краем»).
 *
 * После обрезки заполнение панели, у которой ВЕСЬ путь от листа до самой
 * панели обрезающий (нет промежуточного `overflow: visible`, как и у всех
 * панелей разворота кейса сегодня — `.frame` в `CaseSpread.astro` ничего не
 * обрезает сам, но и не разрешает детям вылезать за собственные клипующие
 * обёртки), не может законно перейти за 100 %. Предел поставлен не в
 * 100,0 %, а в 101 % — запас на субпиксельное округление
 * `getBoundingClientRect()` (дробные ширины у флекс-раскладок), а не допуск
 * для новой находки: три из четырёх панелей `zayavka-hub` дают ровно
 * 100,0 % на обеих проверяемых ширинах уже сегодня. Число выше 101 %
 * означает, что нашёлся контент, который физически выходит за раму
 * панели БЕЗ клипующего предка между собой и панелью, — предел
 * НЕ ослабляется, если однажды даст красный (тот же инвариант брифа, что
 * уже действует у нижней границы): это находка о раскладке, а не повод
 * поднять число.
 */
export const PAINT_FILL_MAX_RATIO = 1.01;

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
 *  попадала как раз такая обёртка.
 *
 *  Каждый собранный прямоугольник обрезается по ближайшему предку с
 *  РЕАЛЬНЫМ CSS-обрезанием (`overflow-x`/`overflow-y` в `hidden`/`clip`/
 *  `scroll`/`auto`) между листом и панелью — не по границам самой панели
 *  безусловно. Находка — трио-раскладка разворота `zayavka-hub` (панель
 *  2/4, раздел 3.3 брифа `12-case-pages-brief.md`): на ≤599 px три кадра
 *  лежат в горизонтальной ленте `.shots.trio { overflow-x: auto }` шириной
 *  ~2,3 панели — второй и третий кадр НАРОЧНО стоят за пределами видимой
 *  полосы (тот самый «выглядывает краем»), и их полный
 *  `getBoundingClientRect()` тянется далеко за правый край панели. Без
 *  обрезки объединение брало этот прирост в габарит краски и давало
 *  заполнение 308,9 % — габарит краски был посчитан верно, но по
 *  контенту, которого физически не видно без прокрутки (тот же род, что
 *  ловушка 8 `50-code/CLAUDE.md`: верная величина не в том месте).
 *
 *  Обрезка привязана к КОНКРЕТНОМУ клипующему предку (здесь — самой ленте
 *  `.shots.trio`, а не к панели безусловно): панель безусловно обрезала бы
 *  заодно и легитимные листья, которые лежат в обычном потоке и НИЧЕМ не
 *  подрезаются браузером, но чуть выходят за геометрическую границу панели
 *  по не относящейся к делу причине (например, `sr-only`-текст доступности
 *  на живой галерее главной — его точная позиция не несёт зрительного
 *  смысла, и обрезка по панели схлопывала бы его до нуля и валила читаемое
 *  заполнение галереи с ~98 % до ~4 % без всякого дефекта раскладки).
 *  Обрезка не прячет находку в другую сторону: пустая или почти пустая
 *  панель по-прежнему даёт низкое заполнение (обрезка только СНИЖАЕТ числа,
 *  никогда не завышает). */
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

  /** Раздел 10.1: элемент, который реально обрезает СВОИХ детей по CSS —
   *  ровно те четыре значения `overflow`, при которых браузер не рисует
   *  содержимое за границами блока. */
  function clipsChildren(el: Element): boolean {
    const cs = getComputedStyle(el);
    const clipValues = ['hidden', 'clip', 'scroll', 'auto'];
    return clipValues.includes(cs.overflowX) || clipValues.includes(cs.overflowY);
  }

  function intersect(a: Box, b: Box): Box {
    return {
      left: Math.max(a.left, b.left),
      top: Math.max(a.top, b.top),
      right: Math.min(a.right, b.right),
      bottom: Math.min(a.bottom, b.bottom),
    };
  }

  function pushRect(rect: { left: number; top: number; right: number; bottom: number }, clip: Box | null) {
    const r = clip ? intersect(rect, clip) : rect;
    const width = r.right - r.left;
    const height = r.bottom - r.top;
    if (width > 0 && height > 0) {
      boxes.push(r);
    }
  }

  function pushSvg(svg: SVGSVGElement, clip: Box | null) {
    const svgRect = svg.getBoundingClientRect();
    const vb = svg.viewBox && svg.viewBox.baseVal;
    if (!vb || vb.width === 0 || vb.height === 0) {
      // Нет viewBox — переводить не из чего, берётся собственный бокс.
      pushRect(svgRect, clip);
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
    }, clip);
  }

  function walk(node: Element, clip: Box | null) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent;
        if (!text || !text.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(child);
        pushRect(range.getBoundingClientRect(), clip);
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as Element;
      if (isHidden(el)) continue; // раздел 10.1.1, пункт 3 — скрытый узел не входит и не обходится глубже
      // Если ЭТОТ узел сам обрезает своих детей по CSS — сужаем клип для
      // всего, что лежит внутри него, ДО того как решаем, лист он или нет:
      // атомарный лист может и сам оказаться таким обрезающим контейнером
      // (например, пустой `overflow:hidden` блок), но обрезка на нём самом
      // не имеет смысла — она касается только его СОДЕРЖИМОГО.
      const innerClip = clipsChildren(el)
        ? (clip ? intersect(clip, el.getBoundingClientRect()) : el.getBoundingClientRect())
        : clip;
      if (el.tagName.toLowerCase() === 'svg') {
        pushSvg(el as unknown as SVGSVGElement, clip);
        continue; // внутрь svg не спускаемся — getBBox уже даёт объединение
      }
      if (el.children.length === 0) {
        pushRect(el.getBoundingClientRect(), clip); // атомарный лист
        continue;
      }
      walk(el, innerClip); // узел с детьми — сам не считается, спускаемся глубже
    }
  }

  walk(panel, null);

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

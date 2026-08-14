/** Геометрия линии на фоне главной — бриф `70-workshop/specs/site-v3/
 *  02-background-line.md`, разделы 4 (схема Ч-3) и 7.1 (атрибуты разметки).
 *
 *  Считается на сборке из `lib/rail.ts` / `lib/sections.ts` — единственных
 *  источников состава секций и точек рельса. Второго списка секций или
 *  переходов здесь не заводится: смени состав `HOME_SECTIONS`, и сторона,
 *  переходы и их число пересчитаются сами (раздел 4, «источник истины —
 *  lib/sections.ts, а не список в CSS»).
 *
 *  Схема Ч-3: переход происходит РОВНО на границе двух точек рельса, нигде
 *  больше. Сторона начинает с левой (раздел 3.5) и чередуется на каждом
 *  переходе — восемь точек рельса дают семь переходов, что и есть решённая
 *  развилка раздела 4.
 */
import { railPoints } from './rail';

/** Плитка перехода (раздел 3.2) — кубическая S-кривая, вертикальная
 *  касательная на обоих концах: viewBox 0 0 1000 192 (192 — верхняя
 *  «стыковая» ступень отступа, раздел 3.3; `mask-size` в CSS растягивает эту
 *  же плитку под фактическую высоту стыка — 48/64/96/128, см.
 *  `BackgroundLine.astro`). `RL_TILE` — зеркало по x (раздел 3.2, «та же
 *  функцией сборки»), не второй нарисованный от руки путь.
 *
 *  Строки, которые `tileUrl()` из них производит, вписаны буквально в
 *  `<style is:global>` `BackgroundLine.astro` (не через `define:vars` —
 *  см. комментарий там, почему: у компонента нет элемента-родителя, на
 *  который повесить переменную, а её отсутствие роняет штрих перехода
 *  молча). Тест `backgroundLine.test.ts` сверяет вписанную в CSS строку с
 *  тем, что производит этот же код СЕЙЧАС — расхождение (например, после
 *  правки кривой) ловится тестом, а не остаётся тихим рассинхроном текста
 *  и источника. */
/* `preserveAspectRatio='none'` — не украшение, а условие того, что переход
   вообще соединяет две вертикали.

   Без него SVG со своим `viewBox` вписывается в полосу маски по умолчанию
   `xMidYMid meet`: сохраняет пропорцию 1000:192 и центрируется. На полосе
   1230×128 это даёт кривую шириной 128 · (1000/192) = 667 px, посаженную по
   центру — то есть переход начинался на 386 px, когда левая вертикаль стоит
   на 105, и обрывался на 1053 при правой вертикали на 1333. Замер сходится
   до пикселя: два «висящих в воздухе» конца по 280 px, которые владелец и
   увидел на экране. `mask-size: 100% 100%` тут не помогает — он задаёт
   КОРОБКУ, а как рисунок ляжет внутри коробки, решает `preserveAspectRatio`.

   С `none` кривая растягивается по коробке неравномерно и упирается концами
   ровно в края полосы, то есть в обе вертикали. Побочно меняется толщина
   штриха: она тоже тянется по осям, поэтому почти вертикальные концы
   становятся чуть толще горизонтальной середины — на глаз это читается как
   нажим пера и направлению не противоречит. */
export const LR_TILE =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 192' preserveAspectRatio='none'><path d='M0,0 C0,96 1000,96 1000,192' stroke='#000' stroke-width='2' fill='none'/></svg>";
export const RL_TILE =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 192' preserveAspectRatio='none'><path d='M1000,0 C1000,96 0,96 0,192' stroke='#000' stroke-width='2' fill='none'/></svg>";

export function tileUrl(svg: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export type LineSide = 'left' | 'right';
/** `'none'` — переход не начинается на этой границе; `'lr'` — слева направо;
 *  `'rl'` — справа налево. */
export type LineCross = 'none' | 'lr' | 'rl';

export interface LineDatum {
  /** Сторона прогона ЭТОЙ секции. */
  side: LineSide;
  /** Начинается ли переход на НИЖНЕМ стыке этой секции — атрибут
   *  `data-line-cross` (раздел 7.1). */
  cross: LineCross;
  /** Заканчивается ли переход на ВЕРХНЕМ стыке этой секции — атрибут
   *  `data-line-cross-top` (раздел 7.1). Всегда равен `cross` секции,
   *  предшествующей этой в порядке страницы — второй источник истины не
   *  заводится, значение выведено, а не продублировано. */
  crossTop: LineCross;
}

function flip(side: LineSide): LineSide {
  return side === 'left' ? 'right' : 'left';
}

/** Считает `LineDatum` для каждой секции, в порядке точек рельса (=порядке
 *  страницы, `railPoints()` уже гарантирует это — `lib/rail.ts`). */
export function computeLineData(): Record<string, LineDatum> {
  const points = railPoints();
  const result: Record<string, LineDatum> = {};
  let side: LineSide = 'left';
  let prevCross: LineCross = 'none';

  points.forEach((point, pi) => {
    const isLastGroup = pi === points.length - 1;
    point.sectionIds.forEach((id, si) => {
      const isLastInGroup = si === point.sectionIds.length - 1;
      const cross: LineCross =
        isLastInGroup && !isLastGroup ? (side === 'left' ? 'lr' : 'rl') : 'none';
      const crossTop: LineCross = si === 0 ? prevCross : 'none';
      result[id] = { side, cross, crossTop };
    });
    const lastId = point.sectionIds[point.sectionIds.length - 1];
    prevCross = result[lastId].cross;
    if (prevCross !== 'none') side = flip(side);
  });

  return result;
}

let cache: Record<string, LineDatum> | null = null;

/** Данные линии для одного якоря секции, либо `null`, если этот `id` не
 *  входит в `HOME_SECTIONS` — так `Section.astro` остаётся безопасным для
 *  страниц вне главной (контакт, 404, согласие…): линия для них просто не
 *  вычисляется, без отдельной ветки кода. Безопасное умолчание раздела 7.1
 *  («секция без атрибутов рисует левый прогон без перехода») здесь не
 *  нужно — на главной каждая секция уже есть в `HOME_SECTIONS`. */
export function lineDataFor(id: string | undefined): LineDatum | null {
  if (!id) return null;
  if (!cache) cache = computeLineData();
  return cache[id] ?? null;
}

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

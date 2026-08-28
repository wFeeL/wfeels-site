import { describe, expect, it } from 'vitest';
import { LINE_PATHS, LINE_STROKE_WIDTH_VB, type LinePathEntry } from './linePaths';
import { flattenPath } from './pathGeometry';
import { homeSectionIds } from './sections';

/** Сторож ПРАВИЛА, не случая — блокер «обрыв хвоста линии на стыке
 *  guarantees → about» (бриф `70-workshop/specs/site-v3/18-line-lower-route-
 *  brief.md` и последующая правка `2026-08-28`, «голый торец»).
 *
 *  Диагноз, который привёл к этому файлу: вынос (`OVERHANG`, `linePaths.ts`)
 *  — приём, которым КАЖДЫЙ путь реестра прячет свой закруглённый торец под
 *  соседний путь, — держался только на том, что соседние пути СЛУЧАЙНО
 *  совпадали по направлению на всём протяжении выноса. `guarantees` несла
 *  вынос `+60` за пределы своей коробки, рассчитывая, что `about` останется
 *  на том же доке (`x=59`) всё это время; на деле `about` сворачивала к
 *  фотографии УЖЕ ВНУТРИ коробки `guarantees`, и часть выноса оставалась
 *  голой — закруглённый торец `guarantees` был виден отдельным обрубком.
 *  Существовавший тогда попарный сторож Г-2 (`linePaths.contract.test.ts`)
 *  этого не ловил: он проверяет «хотя бы ОДНА из двух смежных сторон несёт
 *  вертикаль ≥96 vb» ГДЕ УГОДНО в общей полосе `y`, а не именно там, где
 *  один из путей физически заходит за пределы СВОЕЙ ЖЕ коробки. У `about`
 *  такой участок (прямой ход от `M` до начала кривой) БЫЛ — но лежал
 *  целиком глубоко ВНУТРИ коробки `guarantees`, за 150…260 vb до стыка, и
 *  никак не защищал сам вынос.
 *
 *  ПРАВИЛО (не случай): для КАЖДОЙ пары соседей `(A, B)` — там, где путь A
 *  физически выходит за границу своей коробки (вынос ВНИЗ, за `A.vbH`) ИЛИ
 *  путь B физически заходит за границу своей коробки (заход ВВЕРХ, до `0`,
 *  как у `about`) — на ВСЁМ протяжении этого выступа СОСЕДНИЙ путь обязан
 *  держаться дока в пределах толщины штриха (`LINE_STROKE_WIDTH_VB`, 34 vb):
 *  тогда две обводки физически перекрываются (сумма половин ширины штриха —
 *  ровно одна целая ширина), и закруглённый торец гарантированно прячется
 *  под соседа НЕЗАВИСИМО от того, где именно другой путь решил свернуть.
 *  Совпадение направления соседей — больше не требование: требование —
 *  геометрическое перекрытие обводок именно там, где один из путей выходит
 *  за пределы своей коробки.
 *
 *  Проверка СИММЕТРИЧНА (обе стороны стыка, не только «вниз» — как в
 *  исходном блокере): выступ A вниз проверяет B, ЗАХОД B вверх проверяет A —
 *  один и тот же довод в обе стороны, второго правила не заводится.
 *  Выступа/захода нет (обычный случай — путь кончается ровно на границе
 *  своей коробки) — проверка для этой стороны пуста и не требует ничего
 *  (нечего прятать).
 *
 *  Пары — из `[...homeSectionIds(), 'footer']`, тем же приёмом, что и
 *  `linePaths.contract.test.ts` (ловушка 15/21/24, `50-code/CLAUDE.md`):
 *  список не вписывается руками, меняется сам с составом `HOME_SECTIONS`. */

const TOLERANCE = LINE_STROKE_WIDTH_VB; // сумма половин ширины штриха обеих сторон

function registryPairs(): Array<[string, string]> {
  const ids = [...homeSectionIds(), 'footer'];
  const pairs: Array<[string, string]> = [];
  for (let i = 1; i < ids.length; i++) pairs.push([ids[i - 1], ids[i]]);
  return pairs;
}

/** Максимальное отклонение `x` от `anchorX` вдоль ломаной `flat` в диапазоне
 *  `y ∈ [loY, hiY]` — СЕГМЕНТАМИ, с линейной интерполяцией на границах
 *  диапазона (приём `clippedLength`, `pathGeometry.ts`), а не по готовым
 *  точкам ломаной: прямой путь (`M…L…`) несёт только ДВЕ точки на весь
 *  прогон (обе вне любого короткого диапазона у стыка), и фильтр по готовым
 *  точкам увидел бы «нет точек» там, где прямая на самом деле проходит
 *  ровно через весь диапазон на одном и том же `x`. Пустой диапазон (ни один
 *  сегмент его не пересекает) — `Infinity`: разрыв, где никто не близко к
 *  доку, обязан провалить проверку, а не молча пройти как «нечего
 *  сравнивать». */
function maxDeviationInRange(flat: { x: number; y: number }[], loY: number, hiY: number, anchorX: number): number {
  let found = false;
  let maxDev = 0;
  for (let i = 1; i < flat.length; i++) {
    const a = flat[i - 1];
    const b = flat[i];
    const yLo = Math.min(a.y, b.y);
    const yHi = Math.max(a.y, b.y);
    const lo = Math.max(loY, yLo);
    const hi = Math.min(hiY, yHi);
    if (lo > hi) continue; // сегмент не пересекает диапазон
    const xAt = (y: number) => {
      if (Math.abs(b.y - a.y) < 1e-9) return a.x; // горизонтальный сегмент (не бывает по построению, на всякий случай)
      const t = (y - a.y) / (b.y - a.y);
      return a.x + (b.x - a.x) * t;
    };
    found = true;
    maxDev = Math.max(maxDev, Math.abs(xAt(lo) - anchorX), Math.abs(xAt(hi) - anchorX));
  }
  return found ? maxDev : Infinity;
}

describe('реестр линии — перекрытие обводок там, где путь выходит за пределы своей коробки (блокер «голый торец» guarantees → about)', () => {
  it.each(registryPairs())(`%s → %s: выступ/заход каждой стороны накрыт обводкой соседа (≤ ${TOLERANCE} vb)`, (a, b) => {
    const entryA: LinePathEntry = LINE_PATHS[a];
    const entryB: LinePathEntry = LINE_PATHS[b];
    const flatA = flattenPath(entryA.wide);
    const flatB = flattenPath(entryB.wide);
    const anchorX = flatA[flatA.length - 1].x; // док на стыке — общий для обеих сторон (Г-2)

    // Выступ A вниз, за пределы её же коробки (или недобор — путь A кончился
    // РАНЬШЕ границы `vbH_A`, тот же принцип: «зона, о которой A не
    // отвечает» обязана быть накрыта B). Зона — от границы коробки A
    // (`vbH_A`, локально A) до фактического последнего `y` пути A, в ЛЮБУЮ
    // сторону; переведена в локальную систему B вычитанием `vbH_A`.
    const aEndLocal = flatA[flatA.length - 1].y;
    const zoneADown = [Math.min(entryA.vbH, aEndLocal), Math.max(entryA.vbH, aEndLocal)];
    if (zoneADown[1] - zoneADown[0] > 0.5) {
      const loInB = zoneADown[0] - entryA.vbH;
      const hiInB = zoneADown[1] - entryA.vbH;
      const dev = maxDeviationInRange(flatB, loInB, hiInB, anchorX);
      expect(
        dev,
        `${a}→${b}: ${a} кончает свой путь на y=${aEndLocal.toFixed(1)} (граница коробки — ${entryA.vbH}); в этой зоне (локально ${b}: ${loInB.toFixed(1)}…${hiInB.toFixed(1)}) максимальное отклонение ${b} от дока x=${anchorX.toFixed(1)} составляет ${dev.toFixed(1)} vb`,
      ).toBeLessThanOrEqual(TOLERANCE);
    }

    // Заход B вверх, за пределы ЕЁ коробки (или недобор симметрично) —
    // зеркало предыдущей проверки, переведена в локальную систему A
    // прибавлением `vbH_A`.
    const bStartLocal = flatB[0].y;
    const zoneBUp = [Math.min(0, bStartLocal), Math.max(0, bStartLocal)];
    if (zoneBUp[1] - zoneBUp[0] > 0.5) {
      const loInA = zoneBUp[0] + entryA.vbH;
      const hiInA = zoneBUp[1] + entryA.vbH;
      const dev = maxDeviationInRange(flatA, loInA, hiInA, anchorX);
      expect(
        dev,
        `${a}→${b}: ${b} начинает свой путь на y=${bStartLocal.toFixed(1)} (граница её коробки — 0); в этой зоне (локально ${a}: ${loInA.toFixed(1)}…${hiInA.toFixed(1)}) максимальное отклонение ${a} от дока x=${anchorX.toFixed(1)} составляет ${dev.toFixed(1)} vb`,
      ).toBeLessThanOrEqual(TOLERANCE);
    }
  });
});

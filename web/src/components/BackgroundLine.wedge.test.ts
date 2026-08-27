import { describe, expect, it } from 'vitest';
import { LINE_PATHS } from '../lib/linePaths';
import { flattenPath } from '../lib/pathGeometry';

/** Сторож клина первого экрана (`LINE_PATHS.hero.head`) — бриф `70-workshop/
 *  specs/site-v3/11-line-narrator-brief.md`, раздел 12.8. Клин НЕ проходит
 *  `linePaths.contract.test.ts`: у него нет постоянной ширины обводки (это
 *  заливка, `fill`, не `stroke`), поэтому Г-1/Г-2/Г-4 к нему неприменимы и
 *  `parsePath` намеренно не разбирает завершающую `Z` этой фигуры. Этот файл
 *  доказывает ровно четыре вещи из раздела 12.8, каждую — числом из самой
 *  строки `d`, а не пересказом.
 *
 *  ГЕОМЕТРИЯ ПАРЫ КРОМОК. `head` — замкнутый многоугольник из `N` точек
 *  (`M` + `N-1` раз `L`, закрыт `Z`): первые `N/2` точек идут ПО ЛЕВОЙ
 *  кромке клина от вершины (`u=0`, самый широкий конец) до стыка со штрихом
 *  (`u=1`), следующие `N/2` — ПО ПРАВОЙ кромке в обратном порядке (от `u=1`
 *  обратно до `u=0`). Отсюда точка `i` левой кромки (`0 ≤ i < N/2`) и точка
 *  `N-1-i` правой кромки лежат на ОДНОЙ высоте профиля `u = i/(N/2-1)`, и
 *  расстояние между ними — полная ширина клина в этой точке; половина этого
 *  расстояния — полуширина `hw(u)`, та самая величина профиля раздела 12.4.
 *  Проверено числом: у сегодняшней строки `N=46`, и пара `(0, 45)` даёт
 *  ширину `HEAD_WIDTH_VB=101` (полуширина 50,5 — самый широкий конец,
 *  открытый край клина, который в разметке закрывает шторка сверху), пара
 *  `(22, 23)` даёт полуширину 17,0 (стык со штрихом, `u=1`).
 *
 *  РАСХОЖДЕНИЕ С ФОРМУЛИРОВКОЙ БРИФА (доложено, не подогнано молча): раздел
 *  12.8 говорит «в каждой из 22 точек профиля», а пара кромок сегодняшней
 *  строки даёт 23 точки (`i = 0…22`, `N/2 = 23`) — 22 ШАГА между ними, не 22
 *  точки. Числа геометрии (первая полуширина 50,5, последняя 17,0±0,1,
 *  разность последних двух шагов) от этого разночтения не меняются — просто
 *  «в последней» ниже читается как «в последней из фактических 23», а не
 *  как жёсткое требование к их числу. Тест не завязан на константу `23`:
 *  число точек на кромку выводится из ДЛИНЫ самой строки `d` (`points.length
 *  / 2`), а не вписано руками — тот же приём, что уже применяют реестровые
 *  сторожа против ловушки 15 (`50-code/CLAUDE.md`). */

const HALF_STROKE_VB = 17; // LINE_STROKE_WIDTH_VB / 2 — раздел 12.8, п.1.
const HALF_WIDTH_TOLERANCE_VB = 0.1; // допуск «последняя точка = 17 ± 0,1».
const MAX_STEP_JUMP_VB = 0.6; // разность полуширин двух последних шагов.
const CANVAS_MIN_X = 0;
const CANVAS_MAX_X = 1000;
const RIGHT_EDGE_MARGIN_VB = 10; // запас до правой кромки холста, п.3.

const hero = LINE_PATHS.hero;

describe('линия на фоне — сторож клина первого экрана (раздел 12.8)', () => {
  it('у hero есть заливаемая голова (head) — без неё сторож проверять нечего', () => {
    expect(hero.head, 'LINE_PATHS.hero.head пуст — клин сняли, а сторож остался проверять пустоту').toBeTruthy();
  });

  const points = flattenPath(hero.head!);
  const half = points.length / 2;

  it('строка `d` даёт чётное число точек — ровно две симметричные кромки', () => {
    expect(points.length % 2, `нечётное число точек (${points.length}) — кромки не парны`).toBe(0);
    expect(points.length, 'меньше шести точек — вырожденная фигура, профиль мерить не на чем').toBeGreaterThanOrEqual(6);
  });

  /** Полуширина в профильной точке `i` (`0 ≤ i < half`) — половина
   *  расстояния между точкой `i` левой кромки и её зеркальной парой `N-1-i`
   *  на правой (раздел выше). `i=0` — самый широкий конец (открытый край),
   *  `i=half-1` — стык со штрихом. */
  function halfWidthAt(i: number): number {
    const a = points[i];
    const b = points[points.length - 1 - i];
    return Math.hypot(a.x - b.x, a.y - b.y) / 2;
  }

  const halfWidths = Array.from({ length: half }, (_, i) => halfWidthAt(i));

  it(`связность с обводкой: полуширина ≥ ${HALF_STROKE_VB} vb во всех ${half} точках профиля`, () => {
    halfWidths.forEach((hw, i) => {
      expect(hw, `точка профиля ${i} (u=${(i / (half - 1)).toFixed(3)}): полуширина ${hw.toFixed(2)} < ${HALF_STROKE_VB} — клин перестал накрывать штрих, зазор`).toBeGreaterThanOrEqual(HALF_STROKE_VB - 0.01);
    });
  });

  it(`последняя точка профиля (стык со штрихом) — полуширина ${HALF_STROKE_VB} ± ${HALF_WIDTH_TOLERANCE_VB} vb`, () => {
    const last = halfWidths[half - 1];
    expect(last, `полуширина на стыке ${last.toFixed(3)} vb вне допуска ${HALF_STROKE_VB} ± ${HALF_WIDTH_TOLERANCE_VB}`).toBeGreaterThanOrEqual(HALF_STROKE_VB - HALF_WIDTH_TOLERANCE_VB);
    expect(last, `полуширина на стыке ${last.toFixed(3)} vb вне допуска ${HALF_STROKE_VB} ± ${HALF_WIDTH_TOLERANCE_VB}`).toBeLessThanOrEqual(HALF_STROKE_VB + HALF_WIDTH_TOLERANCE_VB);
  });

  it(`отсутствие излома на стыке: разность полуширин двух последних шагов ≤ ${MAX_STEP_JUMP_VB} vb`, () => {
    const jump = Math.abs(halfWidths[half - 1] - halfWidths[half - 2]);
    expect(jump, `разность ${jump.toFixed(3)} vb превышает ${MAX_STEP_JUMP_VB} — профиль сужается не гладко (линейное сужение даёт ≈1,5 vb и излом 6,8°)`).toBeLessThanOrEqual(MAX_STEP_JUMP_VB);
  });

  it(`габарит: все ${points.length} точек лежат в x ∈ [${CANVAS_MIN_X}, ${CANVAS_MAX_X}]`, () => {
    for (const p of points) {
      expect(p.x, `x=${p.x} < ${CANVAS_MIN_X} — клин ушёл за левую кромку холста`).toBeGreaterThanOrEqual(CANVAS_MIN_X);
      expect(p.x, `x=${p.x} > ${CANVAS_MAX_X} — клин ушёл за правую кромку холста, шторка (шириной ровно с холст) его не кроет`).toBeLessThanOrEqual(CANVAS_MAX_X);
    }
  });

  it(`габарит: запас до правой кромки холста ≥ ${RIGHT_EDGE_MARGIN_VB} vb`, () => {
    const maxX = Math.max(...points.map((p) => p.x));
    const margin = CANVAS_MAX_X - maxX;
    expect(margin, `запас ${margin.toFixed(2)} vb меньше ${RIGHT_EDGE_MARGIN_VB} — вход сдвинут слишком близко к правой кромке (референс на x=967 дал бы отрицательный запас)`).toBeGreaterThanOrEqual(RIGHT_EDGE_MARGIN_VB);
  });

  /* ПРАВКА `2026-08-27` (`70-workshop/specs/site-v3/
   * 15-line-through-scale-brief.md`, раздел 2.3): поле `overhangPercent`
   * снято из `LinePathEntry` вместе с посекционной шторкой — сквозная
   * шторка (`BackgroundLine.astro`, `position: fixed`) накрывает всё, что
   * ниже экранной линии головы, по построению, независимо от бокса своей
   * секции, и ей не нужен вынос под чужой круглый торец. Прежний тест
   * проверял, что вынос посекционной шторки (`overhangPercent · vbH`)
   * достаёт до самой верхней точки клина — эта величина исчезла вместе с
   * механикой, которую измеряла. Верхняя точка клина (`vbY < 0`) при этом
   * остаётся невидимой по не менее надёжной причине: она лежит выше `y=0`
   * первой секции документа, а прокрутка не бывает отрицательной — торца
   * на экране не существует ни на одном значении `scrollY`. */
  it('верхняя точка клина лежит выше y=0 своей коробки — вне видимой прокрутки по построению', () => {
    const minY = Math.min(...points.map((p) => p.y));
    expect(minY, 'самая верхняя точка клина не отрицательна — профиль не поднимается выше секции, проверка не о том').toBeLessThan(0);
  });
});

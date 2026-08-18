/** Реестр путей линии на фоне главной — бриф `70-workshop/specs/site-v3/
 *  05-line.md`, раздел 10, шаг 3: «Реестр `lib/linePaths.ts` по образцу
 *  `50-code/portfolio-site/src/components/ribbonPaths.js`: ключ — id
 *  секции, значение — `{ vbH, wide, narrow }`».
 *
 *  ЭТОТ ШАГ НЕ РИСУЕТ ПУТИ. Одиннадцать путей по назначению 4.3/шаблону 4.4
 *  и карте перекрытия 6.2 рисуются шагом 4 («большая работа», раздел 10).
 *  Здесь в реестр кладутся СЕГОДНЯШНИЕ пути (шаг 2, `computeLineData()` /
 *  `footerLineData()`), механически пересчитанные в целевой формат: одна
 *  запись на секцию, один `vbH`, один путь `wide`, один путь `narrow` —
 *  вместо двух раздельных боксов (`.line-run` + `.line-turn`), которые несёт
 *  сегодняшняя разметка (`BackgroundLine.astro`, `Section.astro`).
 *
 *  Пересчёт, не рисование: `vbH` каждой записи — тот же `runVbH`, что уже
 *  считает `computeLineData()` из измеренной высоты секции (раздел 4.1,
 *  таблица «vbH действующего состава» — те же числа, второй раз не
 *  измерены). `narrow` — прогон-нитка секции как есть (`runD`), он уже
 *  докован и уже покрывает весь `vbH` (раздел 4.3: «прямая» — единственная
 *  форма, которую прогон несёт до шага 4). `wide` для секций БЕЗ перехода —
 *  та же нитка (второго рисунка для неё сегодня не существует); для трёх
 *  секций-владельцев перехода (`services`, `process`, `contact`,
 *  `turnOwners()`) — сегодняшняя кривая перехода (`turnD`), С ПРОДОЛЖЕНИЕМ
 *  прямой линией до низа бокса секции ПО ТОМУ ЖЕ ДОКУ, на котором переход
 *  заканчивается (`entry.side`): сегодня переход и прогон физически рисуются
 *  друг под другом в одной секции (`BackgroundLine.astro`: `.line-turn` —
 *  `top:0`, `.line-run` — `top: var(--line-gap)`), и это ровно то же самое
 *  событие, изображённое в одном пути вместо двух. Ни радиус, ни скорость
 *  этой кривой не меняются — числа берутся из уже существующего `turnD`.
 *
 *  Считается на импорте из `backgroundLine.ts` — второго списка секций,
 *  доков или высот здесь не заводится.
 */
import {
  computeLineData,
  DOCK_LEFT,
  DOCK_RIGHT,
  END_OVERHANG,
  footerLineData,
  type LineDatum,
} from './backgroundLine';
import { HOME_SECTIONS } from './sections';

/** Толщина штриха линии в единицах `viewBox` (раздел 7.2 брифа `05-line`):
 *  `stroke-width: 34` в `BackgroundLine.astro`. Единственный источник числа
 *  для контракт-теста (Г-1: `R_min ≥ 8·w`) — второй раз оно не набрано;
 *  сторож `linePaths.contract.test.ts` сверяет это значение с CSS-файлом,
 *  чтобы правка толщины в вёрстке не разошлась молча с тем, что проверяет
 *  тест. */
export const LINE_STROKE_WIDTH_VB = 34;

export interface LinePathEntry {
  /** `viewBox = 0 0 1000 vbH` — та же величина, что несёт таблица 4.1. */
  vbH: number;
  /** Путь для холста ≥ 900 px (десктопный рисунок). */
  wide: string;
  /** Путь для мобильной нитки (< 900 px, раздел 8) — прямая на доке. */
  narrow: string;
}

/** Продолжает `turnD` прямой линией до низа бокса секции на том же доке,
 *  на котором переход заканчивается (`entry.side` — сторона ПОСЛЕ
 *  переворота, см. `computeLineData()`). Тот же приём выноса за `viewBox`
 *  (`END_OVERHANG`), что несёт `runD` — второго числа не заводится. */
function widePathFor(entry: LineDatum): string {
  if (entry.turn === 'none' || entry.turnD === null) return entry.runD;
  const dockX = entry.side === 'left' ? DOCK_LEFT : DOCK_RIGHT;
  return `${entry.turnD} L${dockX},${entry.runVbH + END_OVERHANG}`;
}

function toEntry(entry: LineDatum): LinePathEntry {
  return { vbH: entry.runVbH, wide: widePathFor(entry), narrow: entry.runD };
}

/** Реестр: десять секций главной + подвал (`footer`, отдельный ключ — как в
 *  `computeLineData()`/`footerLineData()`, свой `vbH`, своя нитка). */
export const LINE_PATHS: Readonly<Record<string, LinePathEntry>> = (() => {
  const data = computeLineData();
  const result: Record<string, LinePathEntry> = {};
  for (const s of HOME_SECTIONS) result[s.id] = toEntry(data[s.id]);

  const footer = footerLineData();
  result.footer = { vbH: footer.runVbH, wide: footer.runD, narrow: footer.runD };

  return result;
})();

/** Реестр путей линии на фоне главной — бриф `70-workshop/specs/site-v3/
 *  05-line.md`, раздел 10, шаг 4: «Нарисовать одиннадцать путей по
 *  назначению 4.3, шаблону 4.4 и карте перекрытия 6.2. Рисуются руками,
 *  по одному, каждый — со снимком своей секции».
 *
 *  Файл несёт ДВА слоя, и это сделано намеренно, а не по небрежности:
 *
 *  1. `FALLBACK` — механический пересчёт сегодняшней (шаг 2) геометрии в
 *     целевой формат, как этот файл был устроен после шага 3. Он остаётся
 *     здесь для секций, которые ЕЩЁ не нарисованы: контракт-тест обязан
 *     показывать их красными («на ненарисованных записях — честно красный»,
 *     раздел 10 плана), а не молчать о них, выкинув ключ из реестра.
 *  2. `HAND_DRAWN` — одиннадцать путей, дорисованных вручную один за
 *     другим (раздел 4.3 назначение, раздел 4.4 шаблон траверса, раздел 6.2
 *     карта перекрытия). Каждая запись здесь — отдельный коммит. `LINE_PATHS`
 *     — слияние: `HAND_DRAWN` перекрывает `FALLBACK` по мере рисования.
 *
 *  Три помощника (`straightPath`, `traversePath`, `dipPath`) — не общая
 *  формула вместо рисунка, а инструмент того же рода, что уже несёт
 *  `backgroundLine.ts` (`mirrorD`): каждый вызов — решение, куда идёт путь
 *  ИМЕННО этой секции; числа (доки, амплитуда, точка пика) подобраны рукой
 *  под карту перекрытия конкретной секции и проверены контракт-тестом плюс
 *  снимком на живой странице, а не выведены единой формулой на всех.
 *
 *  `narrow` — мобильная нитка (< 900 px, раздел 8): всегда левый док, без
 *  событий — раздел 8 «секция без данных рисует прямую нитку в левом поле»,
 *  тот же приём здесь для КАЖДОЙ секции: мобильная ширина ниже порога 900 px
 *  (раздел 6), на котором вообще стоит рисунок, событий там нет по Г-4
 *  («промежуточных значений нет»).
 */
import {
  computeLineData,
  computeVbH,
  DOCK_LEFT as OLD_DOCK_LEFT,
  DOCK_RIGHT as OLD_DOCK_RIGHT,
  END_OVERHANG as OLD_END_OVERHANG,
  footerLineData,
  MEASURED_FOOTER_HEIGHT,
  MEASURED_SECTION_HEIGHT,
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

/* ─────────────────────── 1. FALLBACK (шаг 3, не рисунок) ───────────────
 * Дословно переносится из состояния файла после шага 3 — механический
 * пересчёт `computeLineData()`/`footerLineData()` в формат реестра. */

function widePathForFallback(entry: LineDatum): string {
  if (entry.turn === 'none' || entry.turnD === null) return entry.runD;
  const dockX = entry.side === 'left' ? OLD_DOCK_LEFT : OLD_DOCK_RIGHT;
  return `${entry.turnD} L${dockX},${entry.runVbH + OLD_END_OVERHANG}`;
}

function toFallbackEntry(entry: LineDatum): LinePathEntry {
  return { vbH: entry.runVbH, wide: widePathForFallback(entry), narrow: entry.runD };
}

const FALLBACK: Readonly<Record<string, LinePathEntry>> = (() => {
  const data = computeLineData();
  const result: Record<string, LinePathEntry> = {};
  for (const s of HOME_SECTIONS) result[s.id] = toFallbackEntry(data[s.id]);
  const footer = footerLineData();
  result.footer = { vbH: footer.runVbH, wide: footer.runD, narrow: footer.runD };
  return result;
})();

/* ─────────────────────── 2. Рисование (раздел 4.3/4.4/6.2) ─────────────── */

/** Раздел 4.2: левый и правый причал, одинаковы для всех секций. */
const DOCK_LEFT = 59;
const DOCK_RIGHT = 941;
/** Раздел 3, Г-2: вынос концов пути за `viewBox` — торец `round` прячется
 *  под соседний бокс. Тот же приём, что несёт `backgroundLine.ts`. */
const OVERHANG = 60;
/** Раздел 3, Г-2: прямой вертикальный участок на каждом конце пути —
 *  порог 96, здесь взято с запасом 100, чтобы округление кривой не роняло
 *  проверку на десятые доли единицы. */
const STRAIGHT_IN_OUT = 100;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Прогон — прямая на доке `dockX` (раздел 4.3: «прямая» — секция
 *  спокойная, боковой ход 0). */
function straightPath(vbH: number, dockX: number): string {
  return `M${dockX},${-OVERHANG} L${dockX},${round2(vbH + OVERHANG)}`;
}

/** Мобильная нитка — всегда левый док, вся высота секции (раздел 8). */
function narrowPath(vbH: number): string {
  return straightPath(vbH, DOCK_LEFT);
}

/** Траверс (раздел 4.4): вертикальный вход `STRAIGHT_IN_OUT` (прямая `L`,
 *  а не затухающая кривизна кубики — раздел 12: «на этом линия ломалась уже
 *  дважды», прямой хвост гарантирует Г-2 безусловно, не приближённо), затем
 *  ОДНА симметричная кубика с вертикальной касательной на обоих концах
 *  (оба контрольных узла лежат на высоте середины хода `mid` — классическая
 *  S-кривая без стыков) — ровно та конструкция, для которой раздел 4.4
 *  считает оценку радиуса `R = 3/8 · dy² / dx`, и затем снова вертикальный
 *  выход `STRAIGHT_IN_OUT`. `xFrom` → `xTo` — доки входа и выхода (не
 *  обязательно оба края холста: у `contact` выход — середина, «сход к
 *  середине», раздел 4.3). */
function traversePath(vbH: number, xFrom: number, xTo: number): string {
  const yA = STRAIGHT_IN_OUT;
  const yB = round2(vbH - STRAIGHT_IN_OUT);
  const mid = round2((yA + yB) / 2);
  return (
    `M${xFrom},${-OVERHANG} L${xFrom},${yA} ` +
    `C${xFrom},${mid} ${xTo},${mid} ${xTo},${yB} ` +
    `L${xTo},${round2(vbH + OVERHANG)}`
  );
}

/** Раздел 4.3 `cases`: «выход внутрь и обратно» — единственное событие
 *  страницы, которое не меняет сторону (`turn='none'` у `cases`, группа
 *  держит `right` весь акт «дело»). Симметричный туда-обратно от дока
 *  `dock` к `peakX` и назад, пик в открытой полосе карты 6.2 (между полями
 *  `+262…646` и `+1014…1590`, у `cases` — «крест-накрест», раздел 6.2). */
function dipPath(vbH: number, dock: number, peakX: number, peakYFrac: number): string {
  const dx = peakX - dock;
  const yA = STRAIGHT_IN_OUT;
  const yB = round2(vbH - STRAIGHT_IN_OUT);
  const peakY = round2(yA + peakYFrac * (yB - yA));
  const inSpan = peakY - yA;
  const outSpan = yB - peakY;
  const yIn = (f: number) => round2(yA + f * inSpan);
  const yOut = (f: number) => round2(peakY + f * outSpan);
  const xIn = (f: number) => round2(dock + f * dx);
  const xOut = (f: number) => round2(peakX - f * dx);
  return (
    `M${dock},${-OVERHANG} L${dock},${yA} ` +
    `C${dock},${yIn(0.35)} ${xIn(0.55)},${yIn(0.7)} ${peakX},${peakY} ` +
    `C${xOut(0.55)},${yOut(0.3)} ${dock},${yOut(0.65)} ${dock},${yB} ` +
    `L${dock},${round2(vbH + OVERHANG)}`
  );
}

const vbHOf = (id: string) => computeVbH(MEASURED_SECTION_HEIGHT[id]);

/** Одиннадцать нарисованных путей (раздел 10, шаг 4). Ключ появляется
 *  здесь по мере рисования — один за другим, каждый со своим коммитом. */
const HAND_DRAWN: Partial<Record<string, LinePathEntry>> = {
  // hero — раздел 4.3: «прямая, левый причал»; первая секция страницы, с
  // неё начинается линия левым доком ([[00-overview]]).
  hero: (() => {
    const h = vbHOf('hero');
    return { vbH: h, wide: straightPath(h, DOCK_LEFT), narrow: narrowPath(h) };
  })(),
  // pain — раздел 4.3: «прямая», 663 px < 850 (Г-3) — событие не
  // помещается; продолжает левый док, на котором закончился hero.
  pain: (() => {
    const h = vbHOf('pain');
    return { vbH: h, wide: straightPath(h, DOCK_LEFT), narrow: narrowPath(h) };
  })(),
  // services — раздел 4.3: «траверс слева направо» — граница акта 1→2
  // (Ч-4). Карта 6.2: карточки 170…710/730…1270 × +245…853/+905…1426,
  // открыто сверху (< 245), в полосе +853…905 и снизу (> 1426); траверс
  // проходит между этими полосами, его вторая вершина — внутри полосы
  // карточек (раздел 4.4: «скрыта ими», для Л-2 законно).
  services: (() => {
    const h = vbHOf('services');
    return {
      vbH: h,
      wide: traversePath(h, DOCK_LEFT, DOCK_RIGHT),
      narrow: narrowPath(h),
    };
  })(),
  // pricing — раздел 4.3: «прямая, правый причал» — пауза после события
  // services, продолжает правый док, на котором тот закончился.
  pricing: (() => {
    const h = vbHOf('pricing');
    return { vbH: h, wide: straightPath(h, DOCK_RIGHT), narrow: narrowPath(h) };
  })(),
};

export const LINE_PATHS: Readonly<Record<string, LinePathEntry>> = {
  ...FALLBACK,
  ...HAND_DRAWN,
};

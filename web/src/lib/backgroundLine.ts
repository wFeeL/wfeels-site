/** Геометрия линии на фоне главной — бриф `70-workshop/specs/site-v3/
 *  05-line.md`, раздел 10, шаг 2 (физика коробки) поверх раздела 4.2
 *  (доки `x=59`/`x=941`) и раздела 4.1 (`vbH` из измеренной высоты).
 *  Ритм переходов (Ч-4, раздел 4.2 брифа `02-background-line`) НЕ
 *  тронут этим заходом — он остаётся источником стороны/переходов, эта
 *  правка меняет только то, КАК считается `d` и `viewBox` каждого пути.
 *
 *  Форма кривых — раздел 10 брифа `05-line`, шаг 2: «пути пока остаются
 *  прежними — только пересчитанными в новые координаты», рисунок (докинг,
 *  траверсы, события) не решается ДО выбора владельцем варианта раздела 2
 *  и рисуется заново шагом 4, не этим. Прогон здесь — прямая на доке
 *  (сегодняшний прогон и так «почти вертикаль», раздел 1.2: боковой ход
 *  0,27% высоты — прямая ничего не меняет визуально сверх того, что уже
 *  было практически прямой линией). Переход переиспользует ту же
 *  относительную S-кривую, что нёс прежний `TURN_LR_D` (бриф
 *  `02-background-line`, раздел 3.2), пересчитанную с кромки-в-кромку на
 *  док-в-док.
 *
 *  Считается на сборке из `lib/sections.ts` — единственного источника
 *  состава секций и их актов. Второго списка секций, переходов или высот
 *  здесь не заводится: смени `act` у секции — и сторона, переходы и их
 *  число пересчитаются сами.
 */
import { HOME_SECTIONS, type HomeAct, type HomeSection } from './sections';

/* ───────────────────────── Единицы (раздел 4.1 брифа `05-line`) ────────
 *
 * `viewBox` каждого бокса линии — `0 0 1000 vbH`, где `vbH = round(1000 ·
 * H / 1180)`, 1180 — ширина контейнера (`--container`). При окне 1180 px
 * масштаб бокса РОВНО единый по обеим осям — обе оси используют один и
 * тот же контейнер знаменателем, не порознь для ширины и высоты. */
const CONTAINER_REF = 1180;

/** `vbH` бокса высотой `heightPx` (раздел 4.1). Округление — как в самой
 *  спеке (`Math.round`), тесты сверяют то же самое округление, второй
 *  формулы не заводится. */
export function computeVbH(heightPx: number): number {
  return Math.round((1000 * heightPx) / CONTAINER_REF);
}

/* ───────────────────────── Доки (раздел 4.2) ─────────────────────────── */
export const DOCK_LEFT = 59;
export const DOCK_RIGHT = 941;

/** Вынос концов пути за пределы `viewBox` (Г-2, раздел 3, п.2 брифа
 *  `05-line`: «≥ 60 единиц») — торец `stroke-linecap: round` прячется под
 *  соседний бокс, стык не виден. */
const END_OVERHANG = 60;

/** Прогон — прямая на доке своей стороны, раздел 10 шаг 2 (см. коммент
 *  файла: форма прогона не решается этим заходом, прямая — не решение о
 *  форме, а единственное, что можно нарисовать до выбора владельца). */
function runD(vbH: number, dockX: number): string {
  return `M${dockX},${-END_OVERHANG} L${dockX},${vbH + END_OVERHANG}`;
}

/** Переход, слева направо: та же относительная S-кривая, что нёс прежний
 *  `TURN_LR_D` (бриф `02-background-line`, раздел 3.2 — «один язык кривой…
 *  управляющие точки смещены только по вертикали»), пересчитанная с
 *  кромки-в-кромку (`x: 0…1000`) на док-в-док (`x: 59…941`) и с
 *  фиксированной высоты 100 на измеренную `vbHTurn` (раздел 4.1). */
function turnD(vbHTurn: number): string {
  const y = (v: number) => Math.round(((v * vbHTurn) / 100) * 100) / 100;
  return (
    `M${DOCK_LEFT},${y(-40)} C${DOCK_LEFT},${y(50)} ` +
    `${DOCK_RIGHT},${y(50)} ${DOCK_RIGHT},${y(140)}`
  );
}

/** Зеркалит все X-координаты пути `d` относительно `width` (`x → width − x`).
 *  Раздел 3.2: «зеркало… той же функцией сборки, не вторым нарисованным от
 *  руки путём». Каждая пара координат в `d` имеет форму `X,Y` (после `M`
 *  или `C`, через запятую, без пробела) — регулярное выражение находит все
 *  такие пары и заменяет только X. */
function mirrorD(d: string, width: number): string {
  return d.replace(/(-?[\d.]+),(-?[\d.]+)/g, (_, x: string, y: string) => {
    const mirrored = width - Number(x);
    const rounded = Math.round(mirrored * 100) / 100;
    return `${rounded},${y}`;
  });
}

export type LineSide = 'left' | 'right';
/** `'none'` — секция не владеет переходом на своём верхнем стыке;
 *  `'lr'` — переход слева направо; `'rl'` — переход справа налево. */
export type LineTurn = 'none' | 'lr' | 'rl';

export interface LineDatum {
  /** Сторона прогона ЭТОЙ секции. */
  side: LineSide;
  /** Есть ли на ВЕРХНЕМ стыке этой секции переход, и в какую сторону
   *  (раздел 3.3: переход целиком принадлежит нижней секции — второго
   *  атрибута на секции-соседе сверху нет). */
  turn: LineTurn;
  /** `d` прогона этой секции — уже на доке своей `side`. */
  runD: string;
  /** `viewBox` прогона — `0 0 1000 runVbH` (раздел 4.1). */
  runVbH: number;
  /** `d` перехода этой секции, если `turn !== 'none'`; иначе `null`. */
  turnD: string | null;
  /** `viewBox` перехода — `0 0 1000 turnVbH`, если `turn !== 'none'`;
   *  иначе `null`. */
  turnVbH: number | null;
}

/* ───────────────────────── Ч-4 «Акт» (раздел 4.2) ───────────────────────
 *
 * Переход стоит на границе актов страницы. Переход, который оставил бы
 * прогон короче одного экрана (900 px), поглощается предыдущим актом —
 * читается как: акт-группа короче 900 px сливается с ПРЕДЫДУЩЕЙ группой, и
 * заново на объединённой группе проверять больше нечего (на действующем
 * составе достаточно одного прохода, раздел 4 не описывает каскад).
 *
 * Высоты ниже — не второй список секций, а измеренная величина (раздел 0
 * брифа: «числа не выведены и не округлены»), нужная ТОЛЬКО для решения
 * Ч-4. Измерено `getBoundingClientRect()` на живой сборке этого захода,
 * ширина окна 1180 px (`--container`), 2026-08-18 — тем же приёмом, каким
 * раздел 0 брифа получил свои числа. Правка состава или объёма секции
 * требует переизмерения; тест `backgroundLine.test.ts` пересчитывает
 * результат из этой же таблицы, а не хранит его отдельно. */
export const MEASURED_SECTION_HEIGHT: Readonly<Record<string, number>> = {
  hero: 891,
  pain: 663,
  services: 1538,
  pricing: 1334,
  cases: 2832,
  process: 1279,
  guarantees: 893,
  about: 574,
  faq: 543,
  contact: 966,
};

/** Высота подвала — часть акта «выход» наравне с `contact` (раздел 7.2:
 *  «подвал получает один элемент line-run с той же стороной, что у
 *  contact»). Измерено тем же приёмом, что и таблица выше. */
export const MEASURED_FOOTER_HEIGHT = 469;

/** Минимальный прогон — «один экран эталонной высоты», раздел 4.2. Совпадает
 *  с точкой перелома 900 px, уже стоящей в системе (раздел 6) — вторым
 *  числом не заводится. */
const MIN_RUN = 900;

interface ActGroup {
  act: HomeAct;
  ids: string[];
  height: number;
}

/** Группирует секции по актам (плюс подвал в группу «выход»), затем сливает
 *  группу короче `MIN_RUN` с ПРЕДЫДУЩЕЙ — Ч-4, вторая половина правила.
 *  Первая группа («вход») слиянию не подлежит: сливать её не с чем. */
export function computeActGroups(
  sections: readonly HomeSection[] = HOME_SECTIONS,
  heights: Readonly<Record<string, number>> = MEASURED_SECTION_HEIGHT,
  footerHeight: number = MEASURED_FOOTER_HEIGHT,
): ActGroup[] {
  const raw: ActGroup[] = [];
  for (const s of sections) {
    const last = raw[raw.length - 1];
    if (last && last.act === s.act) {
      last.ids.push(s.id);
      last.height += heights[s.id] ?? 0;
    } else {
      raw.push({ act: s.act, ids: [s.id], height: heights[s.id] ?? 0 });
    }
  }
  // Подвал продолжает последнюю группу («выход») — тот же акт, тот же
  // объект прогона по стороне (раздел 7.2), участвует в том же пороге.
  raw[raw.length - 1].height += footerHeight;

  const merged: ActGroup[] = [];
  for (const group of raw) {
    if (merged.length > 0 && group.height < MIN_RUN) {
      const prev = merged[merged.length - 1];
      prev.ids.push(...group.ids);
      prev.height += group.height;
    } else {
      merged.push({ ...group, ids: [...group.ids] });
    }
  }
  return merged;
}

/** Высота бокса перехода в РЕАЛЬНЫХ пикселях при ширине контейнера
 *  (1180 px) — раздел 4.1 брифа `05-line` считает `vbH` от этой самой
 *  ширины, поэтому переход берёт значение `--line-gap` НА НЕЙ, не на
 *  какой-то другой точке перелома (`BackgroundLine.astro`: `≥ 900px` даёт
 *  64/96/128 по стыку/интерьеру — контейнер 1180 внутри этой ступени). */
function turnGapPx(id: string, sections: readonly HomeSection[]): number {
  return isActStitch(id, sections) ? 128 : 96;
}

/** Считает `LineDatum` для каждой секции — сторона, переход, оба `d` и оба
 *  `vbH`, выведенные из групп Ч-4 и измеренных высот (раздел 4.1 брифа
 *  `05-line`). Старт — левая сторона ([[00-overview]]). */
export function computeLineData(
  sections: readonly HomeSection[] = HOME_SECTIONS,
  heights: Readonly<Record<string, number>> = MEASURED_SECTION_HEIGHT,
  footerHeight: number = MEASURED_FOOTER_HEIGHT,
): Record<string, LineDatum> {
  const groups = computeActGroups(sections, heights, footerHeight);
  const result: Record<string, LineDatum> = {};
  let side: LineSide = 'left';

  groups.forEach((group, gi) => {
    const isFirstGroup = gi === 0;
    // Направление перехода читается по СТОРОНЕ ПРЕДЫДУЩЕЙ группы (`side`
    // ещё не перевёрнут ниже): были слева — переход слева направо ('lr'),
    // были справа — 'rl'.
    const turn: LineTurn = isFirstGroup ? 'none' : side === 'left' ? 'lr' : 'rl';
    // `side` для ЭТОЙ группы — переворачивается на каждой границе (первая
    // группа начинает слева и переход не несёт).
    if (!isFirstGroup) side = side === 'left' ? 'right' : 'left';

    const dockX = side === 'left' ? DOCK_LEFT : DOCK_RIGHT;
    const ownerId = group.ids[0];
    const turnVbH = turn === 'none' ? null : computeVbH(turnGapPx(ownerId, sections));
    const turnDatum =
      turn === 'none' ? null : turn === 'lr' ? turnD(turnVbH!) : mirrorD(turnD(turnVbH!), 1000);

    group.ids.forEach((id, si) => {
      const runVbH = computeVbH(heights[id] ?? 0);
      result[id] = {
        side,
        turn: si === 0 ? turn : 'none',
        runD: runD(runVbH, dockX),
        runVbH,
        turnD: si === 0 ? turnDatum : null,
        turnVbH: si === 0 ? turnVbH : null,
      };
    });
  });

  return result;
}

/** Секции, которые ВЛАДЕЮТ переходом на своём верхнем стыке — то же самое,
 *  что `computeLineData()[id].turn !== 'none'`, но без пересчёта данных для
 *  вызывающих, которым нужен только список (тесты приёмки, раздел 9 п. 10). */
export function turnOwners(
  sections: readonly HomeSection[] = HOME_SECTIONS,
  heights: Readonly<Record<string, number>> = MEASURED_SECTION_HEIGHT,
  footerHeight: number = MEASURED_FOOTER_HEIGHT,
): string[] {
  const data = computeLineData(sections, heights, footerHeight);
  return sections.filter((s) => data[s.id].turn !== 'none').map((s) => s.id);
}

let cache: Record<string, LineDatum> | null = null;

/** Данные линии для одного якоря секции, либо `null`, если этот `id` не
 *  входит в `HOME_SECTIONS` — так `Section.astro` остаётся безопасным для
 *  страниц вне главной (контакт, 404, согласие…). Безопасное умолчание
 *  раздела 7.2 («секция без атрибутов рисует левый прогон без перехода»)
 *  не нужно на главной: там каждый `id` уже есть в `HOME_SECTIONS`. */
export function lineDataFor(id: string | undefined): LineDatum | null {
  if (!id) return null;
  if (!cache) cache = computeLineData();
  return cache[id] ?? null;
}

/** Прогон и сторону подвала — та же сторона (тот же док), что у `contact`
 *  (раздел 7.2). Собственного перехода подвал не несёт: он продолжает акт
 *  «выход», а не начинает новый. Свой `d`, а не буквально `contact`-овский:
 *  подвал ниже (`MEASURED_FOOTER_HEIGHT` = 469 против 966 у `contact`), и
 *  его `vbH` (раздел 4.1) обязан отражать СОБСТВЕННУЮ высоту — переиспользуй
 *  `contact`-овский `d`, и координаты, посчитанные под чужой `vbH`, залезут
 *  за пределы бокса подвала или, наоборот, не дотянутся до его низа. */
export function footerLineData(): Pick<LineDatum, 'side' | 'runD'> & { runVbH: number } {
  const data = computeLineData();
  const last = HOME_SECTIONS[HOME_SECTIONS.length - 1];
  const { side } = data[last.id];
  const dockX = side === 'left' ? DOCK_LEFT : DOCK_RIGHT;
  const runVbH = computeVbH(MEASURED_FOOTER_HEIGHT);
  return { side, runD: runD(runVbH, dockX), runVbH };
}

/** `topGap: 'stitch'` (`pages/index.astro`, `GAP`) выведен из смены `act`
 *  между этой секцией и предыдущей — раздел 4.2: «GAPS выводит topGap:
 *  'stitch' из смены act». Стык считается «стыком акта» только между двумя
 *  ПРОНУМЕРОВАННЫМИ актами (1↔2, 2↔3): границы «вход→1» и «3→выход» несут
 *  смену `act`, но их ритм отступов страница уже решила симметричным
 *  (раздел 3.3, «оба края… сохраняют старое симметричное поведение») — эта
 *  функция считает именно то же самое, а не второе правило рядом. */
export function isActStitch(
  id: string,
  sections: readonly HomeSection[] = HOME_SECTIONS,
): boolean {
  const i = sections.findIndex((s) => s.id === id);
  if (i <= 0) return false;
  const prevAct = sections[i - 1].act;
  const act = sections[i].act;
  return typeof prevAct === 'number' && typeof act === 'number' && prevAct !== act;
}

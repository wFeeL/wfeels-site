/** Геометрия линии на фоне главной — бриф `70-workshop/specs/site-v3/
 *  02-background-line.md`, разделы 3 (геометрия), 4 (ритм переходов Ч-4
 *  «Акт») и 7.2 (атрибуты разметки). Переписан целиком 2026-08-18:
 *  прежняя механика (схема Ч-3, плитка-маска) снята — история решения в
 *  разделах 3.0 и 4.3 самого брифа, не здесь.
 *
 *  Считается на сборке из `lib/sections.ts` — единственного источника
 *  состава секций и их актов. Второго списка секций, переходов или высот
 *  здесь не заводится: смени `act` у секции — и сторона, переходы и их
 *  число пересчитаются сами.
 */
import { HOME_SECTIONS, type HomeAct, type HomeSection } from './sections';

/* ───────────────────────── Геометрия кривой (раздел 3.2) ───────────────
 *
 * Один язык кривой на все три объекта (прогон, переход, хвост): кубическая
 * кривая, управляющие точки смещены только по вертикали — касательная на
 * обоих концах строго вертикальна. Base-строки ниже — ЛЕВАЯ версия прогона
 * и версия перехода «слева направо» (та же кривая, повёрнутая на 90°,
 * раздел 3.2); зеркальные версии не пишутся вторым путём от руки —
 * `mirrorD` производит их из тех же чисел.
 *
 * Оба конца КАЖДОГО пути выведены за пределы своего `viewBox` (раздел 3.6,
 * приёмка п. 4): у прогона `y` от −40 до 1040 при высоте viewBox 1000, у
 * перехода — от −40 до 140 при высоте viewBox 100. Круглый торец
 * (`stroke-linecap: round`) прячется под соседний элемент, стыки не видно. */

/** Прогон, левая сторона: `x=100` — док (внутренняя, ближняя к тексту
 *  сторона), `x=0` — наружный экстремум (ближняя к кромке окна сторона).
 *  `viewBox="0 0 100 1000"`. */
const RUN_LEFT_D = 'M100,-40 C100,180 0,320 0,500 C0,680 100,820 100,1040';

/** Переход, слева направо: `x=0` — левый док, `x=1000` — правый док.
 *  `viewBox="0 0 1000 100"`. */
const TURN_LR_D = 'M0,-40 C0,50 1000,50 1000,140';

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
  /** `d` прогона этой секции — уже зеркалирован под `side`. */
  runD: string;
  /** `d` перехода этой секции, если `turn !== 'none'`; иначе `null`. */
  turnD: string | null;
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

/** Считает `LineDatum` для каждой секции — сторона, переход и оба `d`,
 *  выведенные из групп Ч-4. Старт — левая сторона ([[00-overview]]). */
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

    const runD = side === 'left' ? RUN_LEFT_D : mirrorD(RUN_LEFT_D, 100);
    const turnD = turn === 'none' ? null : turn === 'lr' ? TURN_LR_D : mirrorD(TURN_LR_D, 1000);

    group.ids.forEach((id, si) => {
      result[id] = {
        side,
        turn: si === 0 ? turn : 'none',
        runD,
        turnD: si === 0 ? turnD : null,
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

/** Прогон и сторону подвала — тот же язык кривой, та же сторона, что у
 *  `contact` (раздел 7.2). Собственного перехода подвал не несёт: он
 *  продолжает акт «выход», а не начинает новый. */
export function footerLineData(): Pick<LineDatum, 'side' | 'runD'> {
  const data = computeLineData();
  const last = HOME_SECTIONS[HOME_SECTIONS.length - 1];
  const { side, runD } = data[last.id];
  return { side, runD };
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

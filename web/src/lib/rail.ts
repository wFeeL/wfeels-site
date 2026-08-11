import { HOME_SECTIONS } from './sections';

/** Одна точка рельса — группа секций под одной меткой (спека 02-home.md,
 *  раздел 3). Список точек не заводится вторым перечнем: он выведен из
 *  `HOME_SECTIONS`, единственного источника (`lib/sections.ts`). */
export interface RailPoint {
  /** Метка точки. Словарь один на шапку и рельс: `ЦЕНЫ`, не `ПРАЙС`. */
  label: string;
  /** Якорь секции, к которой ведёт клик по точке — секция с `railFirst: true`
   *  в своей группе (`lib/sections.ts`, поле `railFirst`). */
  targetId: string;
  /** Все якоря группы, в порядке страницы. Пока видна любая из них — точка
   *  активна (план, задача 4). */
  sectionIds: string[];
}

/** Семь точек рельса, в порядке первого появления метки на странице.
 *  Группировка — единственное место, где `railLabel` секций схлопывается в
 *  точки; и разметка (`components/Rail.astro`), и тест читают именно её, а
 *  не собирают точки заново. */
export function railPoints(): RailPoint[] {
  const points: RailPoint[] = [];
  for (const s of HOME_SECTIONS) {
    let point = points.find((p) => p.label === s.railLabel);
    if (!point) {
      point = { label: s.railLabel, targetId: '', sectionIds: [] };
      points.push(point);
    }
    point.sectionIds.push(s.id);
    // `railFirst` — контракт `sections.ts`: ровно одна секция группы несёт
    // этот признак, и это обязана быть секция с наименьшим номером
    // (проверено `sections.test.ts`). Читаем его явно, а не полагаемся на
    // порядок обхода массива, — так группировка не развалится молча, если
    // порядок `HOME_SECTIONS` когда-нибудь перестанет совпадать с порядком
    // якорей на странице.
    if (s.railFirst) point.targetId = s.id;
  }
  return points;
}

/** Якорь → точка, которой он принадлежит. Строит скрипт рельса на клиенте не
 *  из этой функции (там нет `lib/sections.ts` в бандле намеренно — см.
 *  комментарий в `Rail.astro`), а сам список полезен тесту и другим local-only
 *  потребителям. */
export function sectionToRailLabel(sectionId: string): string | null {
  for (const p of railPoints()) {
    if (p.sectionIds.includes(sectionId)) return p.label;
  }
  return null;
}

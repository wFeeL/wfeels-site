/**
 * Единственный источник чисел и подписей вычерченного ядра в тизере фабрики
 * (секция 5 «Кейсы», `components/FactoryCore.astro`). Бриф:
 * `70-workshop/specs/site-v3/02-home-core.md`, раздел 2 «Источник истины по
 * числам» — таблица пересчитана 2026-08-11 по
 * `/Users/danya/bot_factory/templates/*\/miniapp/src/styles/themes/`
 * (32 файла `.css`, все с именами тем) и по `50-code/portfolio-site/public/demos/`.
 *
 * Ни одна координата и ни один счётчик рисунка не пишется в разметке руками —
 * `FactoryCore.astro` считает геометрию из этого массива на этапе сборки.
 * Добавили тему — правьте здесь, рисунок и текст обновятся сами; тест-сторож
 * `factory.test.ts` не даст забыть про сумму.
 *
 * «Записанное в базе 13 тем» — неверно, править в базе отдельно
 * (вне этого репозитория, работа `vault-keeper`).
 */

export interface FactoryTemplate {
  /** Техническое имя шаблона — ключ списков, в разметке не показывается. */
  id: string;
  /** Подпись на рисунке — русская, дословно из брифа раздел 2. Не латиница:
   *  читатель — владелец автосервиса или груминг-салона, не разработчик. */
  label: string;
  /** Число тем шаблона. */
  themes: number;
  /** Число снятых демо. У `reservation` — честный ноль: демо не прячется,
   *  шесть тиков этой строки полые. Строка «БРОНЬ» не убирается никогда. */
  demos: number;
}

// Порядок — по themes убыв., при равенстве demos убыв. (бриф, раздел 3).
export const FACTORY: readonly FactoryTemplate[] = [
  { id: 'booking', label: 'ЗАПИСЬ', themes: 12, demos: 4 },
  { id: 'questionnaire', label: 'АНКЕТА', themes: 8, demos: 4 },
  { id: 'storefront', label: 'МАГАЗИН', themes: 6, demos: 3 },
  { id: 'reservation', label: 'БРОНЬ', themes: 6, demos: 0 },
];

/** Считается из `FACTORY`, не пишется руками. Абзац тизера («четыре шаблона,
 *  32 темы, 11 снятых демо») подставляет числа отсюда. */
export const FACTORY_TOTALS = {
  templates: FACTORY.length,
  themes: FACTORY.reduce((sum, t) => sum + t.themes, 0),
  demos: FACTORY.reduce((sum, t) => sum + t.demos, 0),
};

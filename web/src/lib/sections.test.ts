import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HOME_SECTIONS, hasHomeSection, homeSectionIds } from './sections';

/** Точки рельса из спеки 02-home.md, раздел 3, дополненной правкой владельца
 *  2026-08-18 (пункт 23 захода `03-redesign-2026-08-14`: `pain` и `faq`
 *  получили собственные точки вместо общих с соседом) — сверка построчно, а
 *  не на глаз: если кто-то передвинет секцию в другую группу, этот тест
 *  покраснеет раньше, чем рельс задачи 4 подсветит не ту точку. */
const RAIL_MAP: Record<string, number[]> = {
  'НАЧАЛО': [1],
  'КАК БЫВАЕТ': [2],
  'УСЛУГИ': [3],
  'ЦЕНЫ': [4],
  'КЕЙС': [5],
  'ПРОЦЕСС': [6],
  'ГАРАНТИИ': [7],
  'ОБО МНЕ': [8],
  'FAQ': [9],
  'КОНТАКТ': [10],
};

describe('HOME_SECTIONS — целостность списка', () => {
  it('ровно десять секций', () => {
    expect(HOME_SECTIONS.length).toBe(10);
  });

  it('порядок 1..10 без пропусков и повторов', () => {
    expect(HOME_SECTIONS.map((s) => s.order)).toEqual(
      Array.from({ length: 10 }, (_, i) => i + 1),
    );
  });

  it('якоря уникальны', () => {
    const ids = homeSectionIds();
    expect(new Set(ids).size, `повтор среди якорей: ${ids.join(', ')}`).toBe(ids.length);
  });

  it('группировка по точкам рельса совпадает со спекой', () => {
    for (const [label, orders] of Object.entries(RAIL_MAP)) {
      const inGroup = HOME_SECTIONS.filter((s) => s.railLabel === label)
        .map((s) => s.order)
        .sort((a, b) => a - b);
      expect(inGroup, `точка «${label}»`).toEqual(orders);
    }
    // Никакая секция не осталась вне десяти точек таблицы.
    const known = new Set(Object.keys(RAIL_MAP));
    for (const s of HOME_SECTIONS) {
      expect(known.has(s.railLabel), `секция ${s.order} в незнакомой точке «${s.railLabel}»`)
        .toBe(true);
    }
  });

  it('в каждой точке рельса ровно одна первая секция', () => {
    for (const label of Object.keys(RAIL_MAP)) {
      const firsts = HOME_SECTIONS.filter((s) => s.railLabel === label && s.railFirst);
      expect(firsts.length, `точка «${label}»`).toBe(1);
      // И это обязана быть секция с наименьшим номером в группе.
      const group = HOME_SECTIONS.filter((s) => s.railLabel === label);
      const minOrder = Math.min(...group.map((s) => s.order));
      expect(firsts[0].order, `первая в «${label}» — не самая ранняя секция группы`)
        .toBe(minOrder);
    }
  });

  it('шесть якорей навигации присутствуют в списке секций', () => {
    for (const id of ['services', 'pricing', 'cases', 'guarantees', 'about', 'contact']) {
      expect(hasHomeSection(id), `${id} — нет такой секции в sections.ts`).toBe(true);
    }
  });

  it('hasHomeSection не подтверждает несуществующий якорь', () => {
    expect(hasHomeSection('does-not-exist')).toBe(false);
  });
});

/** Сборка обязана нести якоря дословно те же, что заявлены в `sections.ts` —
 *  не по памяти разработчика, а по факту `dist/index.html`. Тест читает файл
 *  сборки напрямую, без браузера: требование спеки — текст и структура секций
 *  присутствуют без выполнения JavaScript, и здесь это проверяется буквально.
 *
 *  Порядок команд из плана — `npm run build` перед `npm run test:unit` — здесь
 *  не формальность, а условие: без сборки тест не может увидеть то, что
 *  проверяет. Раньше отсутствие сборки заставляло эту проверку тихо
 *  пропускаться (`it.runIf`) рядом с отдельным тестом-заглушкой
 *  (`expect(true).toBe(true)`), который зеленел всегда — набор рапортовал
 *  «N passed» даже когда сверка ни разу не выполнилась. Теперь отсутствие
 *  `dist/index.html` — это красный тест с понятным сообщением, а не тихий
 *  пропуск: прогон без сборки не может закончиться зелёным набором с
 *  невыполненной проверкой якорей. */
describe('dist/index.html — соответствие sections.ts', () => {
  const DIST_INDEX = fileURLToPath(new URL('../../dist/index.html', import.meta.url));

  it('набор якорей в разметке совпадает с sections.ts один в один', () => {
    if (!existsSync(DIST_INDEX)) {
      throw new Error(
        `\n${DIST_INDEX} не найден. Эта проверка сверяет якоря dist/index.html ` +
        'со списком в sections.ts и не может подтвердить совпадение без самой ' +
        'сборки. Сначала выполни `npm run build` в web/, затем повтори `npm run test:unit`.',
      );
    }

    const html = readFileSync(DIST_INDEX, 'utf8');
    const found = [...html.matchAll(/<section id="([a-z-]+)"/g)].map((m) => m[1]);

    const expected = homeSectionIds();
    // Обе стороны: секция в sections.ts без разметки и секция в разметке
    // мимо sections.ts — считаются одинаково неисправными.
    expect(new Set(found), 'разметка несёт якоря не из sections.ts')
      .toEqual(new Set(expected));
    expect(found.length, 'якорь встречается на странице не ровно один раз')
      .toBe(expected.length);
  });
});

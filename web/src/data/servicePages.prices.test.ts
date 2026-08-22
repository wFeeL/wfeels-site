/* Критерий 9 спеки 08 «Посадочные страницы услуг»: на странице услуги стоят
 * цены её собственных ступеней — все, и никаких чужих.
 *
 * Сторож заведён 2026-08-22 отдельным файлом, потому что при сдаче страниц
 * этот критерий оказался ЕДИНСТВЕННЫМ из восемнадцати, у которого не было
 * машинной проверки: остальные закрыты `servicePages.test.ts`,
 * `dist-links.test.ts` и `dist-no-yo.test.ts`.
 *
 * Проверка читает МОДУЛИ, а не текст исходника. Это принципиально: при первой
 * попытке тот же критерий проверялся разбором `data/pricing.ts` регулярным
 * выражением, и разбор дважды подряд дал ложную тревогу — ступени объявлены
 * через помощник `tier(group, entry)` позиционными доводами, а не ключом
 * `entry:`, и отображение «имя ступени → цена» молча выходило пустым. Пять
 * страниц из девяти были объявлены сломанными, притом что «чужой» ценой на
 * каждой оказывалась её же собственная. Это ровно тот род ошибки, что описан
 * в `50-code/CLAUDE.md`: проверка есть, проверяет не то. Импорт настоящих
 * `SERVICE_PAGES` и `PRICING` этой лазейки не оставляет.
 *
 * `MILESTONE_THRESHOLD` вычитается законно: порог «по вехам» приходит на
 * страницу с блоком гарантий (`data/process.ts`), а не из таблицы ступеней.
 *
 * Набор идёт по СОБРАННОЙ разметке — нужен `npm run build` перед ним.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SERVICE_PAGES } from './servicePages';
import { PRICING } from './pricing';
import { MILESTONE_THRESHOLD } from './process';

const allPrices = new Set(PRICING.flatMap((g) => g.entries.map((e) => e.price)));
function priceOf(group: string, entry: string): string {
  const e = PRICING.find((g) => g.name === group)?.entries.find((x) => x.name === entry);
  if (!e) throw new Error(`нет ступени ${group}/${entry}`);
  return e.price;
}

describe('критерий 9 — на странице только её собственные цены', () => {
  for (const page of SERVICE_PAGES) {
    const own = new Set(page.tiers.map((t) => priceOf(t.group, t.entry)));
    const html = readFileSync(`dist/services/${page.slug}/index.html`, 'utf8');

    it(`${page.slug} — все свои цены показаны`, () => {
      expect([...own].filter((p) => !html.includes(p))).toEqual([]);
    });

    it(`${page.slug} — ни одной чужой цены`, () => {
      const foreign = [...allPrices].filter(
        (p) => !own.has(p) && p !== MILESTONE_THRESHOLD && html.includes(p),
      );
      expect(foreign).toEqual([]);
    });
  }
});

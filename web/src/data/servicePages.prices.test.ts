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

/* Цена ищется по ГРАНИЦАМ, а не подстрокой.
 *
 * Правка `2026-08-26`. До неё стояло `html.includes(price)`, и сторож был
 * прав ровно до того дня, когда сменились сами числа: при снижении прайса
 * (D-111) он покраснел на четырёх страницах, ни на одной из которых чужой
 * цены нет. Разбор каждого совпадения:
 *
 *   `5 000 ₽` (одна интеграция) — найдено ВНУТРИ `45 000 ₽` на `/services/
 *   website`, `55 000 ₽` на `/services/telegram-miniapp` и `25 000 ₽` на
 *   `/services/ai-consultant`;
 *   `6 000 ₽` (минимальный вход) — найдено внутри СОБСТВЕННОЙ цены страницы
 *   `6 000 ₽/мес` на `/services/website-support`.
 *
 * То есть проверка мерила верную величину негодным способом, и дефект спал
 * до тех пор, пока ни одна ступень не оказалась началом другой. Это тот же
 * род, что описан в `50-code/CLAUDE.md`: сторож есть, ловит не то. Ослаблять
 * его нельзя — критерий 9 настоящий: покупатель на странице услуги не должен
 * видеть цену другой услуги.
 *
 * Две границы, обе выведены из разобранных совпадений, а не подобраны:
 *   слева — перед ценой не может стоять цифра (иначе `5 000` внутри `45 000`);
 *   справа — за ценой не может стоять `/` (иначе `6 000 ₽` внутри `6 000 ₽/мес`).
 * Пробел слева законен и частый: «от 10 000 ₽».
 */
function mentions(html: string, price: string): boolean {
  const escaped = price.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<!\\d)${escaped}(?!/)`).test(html);
}

describe('критерий 9 — на странице только её собственные цены', () => {
  for (const page of SERVICE_PAGES) {
    const own = new Set(page.tiers.map((t) => priceOf(t.group, t.entry)));
    const html = readFileSync(`dist/services/${page.slug}/index.html`, 'utf8');

    it(`${page.slug} — все свои цены показаны`, () => {
      expect([...own].filter((p) => !mentions(html, p))).toEqual([]);
    });

    it(`${page.slug} — ни одной чужой цены`, () => {
      const foreign = [...allPrices].filter(
        (p) => !own.has(p) && p !== MILESTONE_THRESHOLD && mentions(html, p),
      );
      expect(foreign).toEqual([]);
    });
  }
});

import { PRICING, type PriceEntry } from '../data/pricing';

/** Обращение к ступени `data/pricing.ts` по имени группы и имени записи —
 *  с явной ошибкой сборки вместо тихого `undefined`. Тот же приём, что
 *  `stage()` в `data/pricingShowcase.ts` и `priceFor()` в
 *  `home/Pricing.astro`: страницы услуг (`data/servicePages.ts`) не хранят
 *  цену буквально, только пару `{ group, entry }`, и достают строку цены
 *  отсюда. Ступень, переименованная в `PRICING.md` и перегенерированная
 *  (`data/pricing.ts`), роняет сборку с явным сообщением, а не молча
 *  пропадает со страницы. */
export function priceEntry(group: string, entry: string): PriceEntry {
  const g = PRICING.find((g) => g.name === group);
  if (!g) {
    throw new Error(
      `lib/priceLookup.ts: в data/pricing.ts нет группы «${group}» — на неё ссылается ` +
      'страница услуги (data/servicePages.ts).',
    );
  }
  const e = g.entries.find((e) => e.name === entry);
  if (!e) {
    throw new Error(
      `lib/priceLookup.ts: в группе «${group}» data/pricing.ts нет ступени «${entry}» — ` +
      'на неё ссылается страница услуги (data/servicePages.ts).',
    );
  }
  return e;
}

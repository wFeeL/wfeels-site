import { PRICING, type PriceEntry, type PriceGroup } from './pricing';
import { PRICING_EN } from './pricing.en';
import { assertParallel, type Locale } from '../i18n/locales';

/* Прайс на языке страницы — сборка сгенерированного файла с ручным слоем
 * перевода (`pricing.en.ts`).
 *
 * Английский прайс не перечисляется вторым списком: он СОБИРАЕТСЯ из
 * русского ступень за ступенью, поэтому потерять группу, ступень или
 * переставить их порядок нельзя в принципе. Всё, что английская версия
 * может изменить, — четыре текстовых поля; машинные (`priceUsdReference`,
 * `source`) берутся у оригинала как есть, а цена сверяется по цифрам.
 *
 * Три сторожа стоят ЗДЕСЬ, на загрузке модуля, а не в тестах — расхождение
 * прайса на двух языках обязано ронять сборку:
 *   1. у каждой русской ступени есть английская подпись;
 *   2. цифры английской цены совпадают с русскими знак в знак;
 *   3. состав («что входит») разбит на то же число кусков через запятую —
 *      из них собирается список пунктов карточки в `pricingShowcase.ts`. */

/** Только цифры строки. Сравнение по ним, а не по всей строке, отделяет
 *  ПЕРЕВОД слов («₽/мес» → «₽/mo») от ПОДМЕНЫ числа — первое разрешено,
 *  второе запрещено инвариантом базы «цены только из PRICING.md». */
function digitsOf(price: string): string {
  return price.replace(/\D+/g, '');
}

function commaParts(value: string | null): number {
  return value === null ? 0 : value.split(',').length;
}

function translateEntry(groupName: string, entry: PriceEntry): PriceEntry {
  const text = PRICING_EN[groupName]?.entries[entry.name];
  if (!text) {
    throw new Error(
      `data/pricingLocalized.ts: у ступени «${entry.name}» группы «${groupName}» ` +
      'нет английской подписи в data/pricing.en.ts. Ступень пришла из ' +
      'перезапуска генератора прайса — перевод дописывается вместе с ней, ' +
      'иначе английская страница потеряет строку молча.',
    );
  }
  if (digitsOf(text.price) !== digitsOf(entry.price)) {
    throw new Error(
      `data/pricingLocalized.ts: английская цена ступени «${entry.name}» ` +
      `(«${text.price}») несёт другие цифры, чем русская («${entry.price}»). ` +
      'Переводятся слова вокруг числа, само число — никогда: оно приходит из ' +
      '10-offer/PRICING.md и не выводится, не округляется и не пересчитывается.',
    );
  }
  if (commaParts(text.whatIncluded) !== commaParts(entry.whatIncluded)) {
    throw new Error(
      `data/pricingLocalized.ts: состав ступени «${entry.name}» разбит на ` +
      `${commaParts(text.whatIncluded)} кусков против ${commaParts(entry.whatIncluded)} ` +
      'русских. Из кусков собирается список пунктов карточки цены — потерянная ' +
      'запятая укоротила бы английскую карточку на пункт.',
    );
  }
  return {
    ...entry,
    name: text.name,
    whatIncluded: text.whatIncluded,
    price: text.price,
    note: text.note,
  };
}

const PRICING_LOCALIZED_EN: readonly PriceGroup[] = PRICING.map((group) => {
  const text = PRICING_EN[group.name];
  if (!text) {
    throw new Error(
      `data/pricingLocalized.ts: у группы прайса «${group.name}» нет английской ` +
      'подписи в data/pricing.en.ts.',
    );
  }
  return { name: text.name, entries: group.entries.map((e) => translateEntry(group.name, e)) };
});

const BY_LOCALE: Record<Locale, readonly PriceGroup[]> = {
  ru: PRICING,
  en: PRICING_LOCALIZED_EN,
};
assertParallel('data/pricingLocalized.ts', BY_LOCALE);

export function pricingFor(locale: Locale): readonly PriceGroup[] {
  return BY_LOCALE[locale];
}

/** Группа прайса по РУССКОМУ имени, на языке страницы.
 *
 *  Ключ поиска всегда русский, и это осознанно: русское имя ступени —
 *  идентификатор строки прайса, а не текст для читателя. Поиск идёт по
 *  русскому списку, а возвращается ступень того же ИНДЕКСА из списка нужного
 *  языка — значит перевод названия не может сломать ни одну ссылку на
 *  ступень. */
export function priceGroup(locale: Locale, groupName: string): PriceGroup {
  const index = PRICING.findIndex((g) => g.name === groupName);
  if (index === -1) {
    throw new Error(`data/pricingLocalized.ts: в data/pricing.ts нет группы «${groupName}».`);
  }
  return pricingFor(locale)[index];
}

export function priceEntry(locale: Locale, groupName: string, entryName: string): PriceEntry {
  const group = PRICING[PRICING.findIndex((g) => g.name === groupName)];
  if (!group) {
    throw new Error(`data/pricingLocalized.ts: в data/pricing.ts нет группы «${groupName}».`);
  }
  const index = group.entries.findIndex((e) => e.name === entryName);
  if (index === -1) {
    throw new Error(
      `data/pricingLocalized.ts: в группе «${groupName}» нет ступени «${entryName}».`,
    );
  }
  return priceGroup(locale, groupName).entries[index];
}

/** Английский состав разбирается по тем же местам, что русский: индексы
 *  кусков совпадают, потому что число кусков сверено сторожем выше. Читатель
 *  этой функции — `pricingShowcase.ts`, где один кусок русского состава
 *  («дизайн-система») снимается с карточки по смыслу, а не по номеру. */
export function compositionIndex(entryName: string, groupName: string, piece: string): number {
  const group = PRICING.find((g) => g.name === groupName);
  const entry = group?.entries.find((e) => e.name === entryName);
  if (!entry?.whatIncluded) {
    throw new Error(
      `data/pricingLocalized.ts: у ступени «${entryName}» нет состава — снимать нечего.`,
    );
  }
  const index = entry.whatIncluded.split(',').map((s) => s.trim()).indexOf(piece);
  if (index === -1) {
    throw new Error(
      `data/pricingLocalized.ts: в составе ступени «${entryName}» нет куска «${piece}» — ` +
      'состав переписан перезапуском генератора, а снятие куска осталось от старой ' +
      'строки. Молча снять не тот пункт нельзя.',
    );
  }
  return index;
}

// Витринный слой секции 4 «Цены» главной — маппинг «ступень `data/pricing.ts`
// → карточка/строка на странице». Заведён отдельным файлом (не куском
// `Pricing.astro`), чтобы у него был свой тест, не завязанный на разбор
// Astro-шаблона: явный маппинг «имя ступени → витринное имя» обязан падать,
// если ступень в прайсе переименована или пропала (`70-workshop/specs/
// site-v3/02-redesign-options.md`, «Принято владельцем», пункт 7).
//
// Ни одна цена здесь не хранится буквально — все читаются из `PriceEntry.
// price`. Файл не генерируется: правится руками, но каждое обращение к
// `data/pricing.ts` идёт через `stage()`/`group()` ниже, которые кидают
// явную ошибку вместо тихого `undefined`.

import { PRICING, type PriceEntry, type PriceGroup } from './pricing';
import { SERVICE_GROUPS, type ServiceIconKind } from './services';

function stage(groupName: string, stageName: string): PriceEntry {
  const entry = PRICING.find((g) => g.name === groupName)?.entries.find((e) => e.name === stageName);
  if (!entry) {
    throw new Error(
      `data/pricingShowcase.ts: в data/pricing.ts нет ступени «${stageName}» группы ` +
      `«${groupName}» — витрина секции 4 главной на неё ссылается.`,
    );
  }
  return entry;
}

function group(groupName: string): PriceGroup {
  const g = PRICING.find((g) => g.name === groupName);
  if (!g) {
    throw new Error(`data/pricingShowcase.ts: в data/pricing.ts нет группы «${groupName}».`);
  }
  return g;
}

/** Ссылка на посадочную услуги — по значку группы `data/services.ts` и
 *  дословному тексту ссылки. Кидает явную ошибку, если ссылку переименовали:
 *  молчаливо увядшая ссылка в витрине цен хуже красной сборки. */
function serviceHref(icon: ServiceIconKind, linkText: string): string {
  const serviceGroup = SERVICE_GROUPS.find((g) => g.icon === icon);
  const link = serviceGroup?.links.find((l) => l.text === linkText);
  if (!link) {
    throw new Error(
      `data/pricingShowcase.ts: у группы услуг «${icon}» нет ссылки «${linkText}» — ` +
      'витрина секции 4 главной на неё ссылается.',
    );
  }
  return link.href;
}

/** Состав ступени («что входит») дословно из PRICING.md, разбитый на пункты
 *  по запятой — так, как он и записан в источнике. */
function splitComposition(whatIncluded: string): string[] {
  return whatIncluded.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Первая буква прописная, точка в конце — «состав ступени» как строка
 *  причины рекомендации, не как список. Сам текст не меняется, только
 *  оформление первой буквы и завершающий знак. */
function asSentence(text: string): string {
  const trimmed = text.trim().replace(/\.+$/, '');
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}.`;
}

/** Ведущее число цены вида «7 500 ₽» → 7500. `null`, если цена не начинается
 *  с числа (словесная формулировка вроде «считать индивидуально»). */
function leadingRub(price: string): number | null {
  const m = /^([\d\s]+)\s*₽/.exec(price);
  if (!m) return null;
  return parseInt(m[1].replace(/\s/g, ''), 10);
}

/** Самая дешёвая числовая ступень группы — представитель группы на полке
 *  («по одной цене «от»»). Вычисляется, а не берётся по индексу 0: порядок
 *  записей в `data/pricing.ts` — порядок PRICING.md, не порядок цены, и
 *  вычисление не рассыпется молча, если однажды группа пополнится более
 *  дешёвой ступенью раньше остальных в источнике. */
function cheapestEntry(g: PriceGroup): PriceEntry {
  const numeric = g.entries
    .map((e) => ({ e, n: leadingRub(e.price) }))
    .filter((x): x is { e: PriceEntry; n: number } => x.n !== null);
  if (numeric.length === 0) {
    throw new Error(`data/pricingShowcase.ts: в группе «${g.name}» нет ни одной числовой цены.`);
  }
  return numeric.reduce((min, cur) => (cur.n < min.n ? cur : min)).e;
}

export interface TopCard {
  /** Витринное имя карточки — НЕ имя ступени прайса (спека, пункт 7). */
  showcaseName: string;
  price: string;
  /** Состав, готовый к выводу списком; первый пункт иногда переопределён —
   *  «до пяти страниц» у корпоративного сайта, «Всё из „Лендинга“» у
   *  среднего варианта. */
  composition: readonly string[];
  recommended?: {
    label: string;
    reason: string;
  };
}

const LANDING_TEMPLATE = stage('Сайты', 'Лендинг из шаблона');
const LANDING_CUSTOM = stage('Сайты', 'Лендинг с индивидуальным дизайном');
const SITE_5 = stage('Сайты', 'Сайт до 5 страниц');

if (!LANDING_TEMPLATE.whatIncluded || !LANDING_CUSTOM.whatIncluded || !SITE_5.whatIncluded) {
  throw new Error('data/pricingShowcase.ts: у одной из трёх верхних ступеней нет состава (whatIncluded).');
}

/** Три верхние карточки группы «Сайты» (спека, пункт 7). Порядок и цены —
 *  15 000 / 30 000 / 50 000 ₽, по возрастанию, как в PRICING.md. Ступень
 *  «Сайт до 10 страниц» (70 000 ₽) сюда не входит — у неё нет отдельного
 *  словесного имени, она живёт на странице услуги (спека 03). */
export const TOP_CARDS: readonly TopCard[] = [
  {
    showcaseName: 'Лендинг на готовом шаблоне',
    price: LANDING_TEMPLATE.price,
    composition: splitComposition(LANDING_TEMPLATE.whatIncluded),
  },
  {
    showcaseName: 'Лендинг',
    price: LANDING_CUSTOM.price,
    // Накопительность (спека, пункт 7): «Всё из «Лендинга»» — правда по
    // составу ступеней PRICING.md на уровне результата, не механизма: ниже
    // не «тоже шаблон», а «тоже готовый лендинг под ключ», плюс перечисленное
    // дальше сверху.
    composition: ['Всё из «Лендинга»', ...splitComposition(LANDING_CUSTOM.whatIncluded)],
    recommended: {
      label: 'Советую этот вариант',
      reason: asSentence(LANDING_CUSTOM.whatIncluded),
    },
  },
  {
    showcaseName: 'Корпоративный сайт',
    price: SITE_5.price,
    // «до пяти страниц» — граница объёма, первой строкой состава (спека,
    // пункт 7): число страниц ушло из заголовка карточки, но не должно
    // всплыть только в переписке.
    composition: ['до пяти страниц', ...splitComposition(SITE_5.whatIncluded)],
  },
];

export interface ShelfRow {
  label: string;
  price: string;
  href: string;
}

/** Полка из трёх строк по остальным группам — по одной, самой дешёвой цене
 *  «от» на группу, со ссылкой на посадочную ближайшей по смыслу ступени. */
export const SHELF_ROWS: readonly ShelfRow[] = [
  {
    label: 'Автоматизация и интеграции',
    price: cheapestEntry(group('Автоматизация и интеграции')).price,
    href: serviceHref('automation', 'Приём заявок и интеграции'),
  },
  {
    label: 'ИИ',
    price: cheapestEntry(group('ИИ')).price,
    href: serviceHref('ai', 'ИИ-консультант по материалам'),
  },
  {
    label: 'Telegram',
    price: cheapestEntry(group('Telegram')).price,
    href: serviceHref('telegram', 'Telegram-бот под задачу'),
  },
];

/** Строка «поддержка и аудит» под полкой — две ступени в одном ряду
 *  (спека, пункт 7: «плюс строкой поддержка и аудит»). */
export const SUPPORT_AUDIT_ROW: readonly ShelfRow[] = [
  {
    label: 'Поддержка',
    price: stage('Поддержка', 'Пакет поддержки').price,
    href: serviceHref('sites', 'Доработка и поддержка'),
  },
  {
    label: 'Аудит',
    price: stage('Сайты', 'Аудит сайта + план правок').price,
    href: serviceHref('sites', 'Аудит сайта'),
  },
];

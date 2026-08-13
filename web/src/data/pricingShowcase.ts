// Витринный слой секции 4 «Цены» главной — маппинг «ступень `data/pricing.ts`
// → карточка/строка на странице». Заведён отдельным файлом (не куском
// `Pricing.astro`), чтобы у него был свой тест, не завязанный на разбор
// Astro-шаблона: явный маппинг «имя ступени → витринное имя» обязан падать,
// если ступень в прайсе переименована или пропала.
//
// Правка владельца 2026-08-13 («Секция цен — десять правок владельца»,
// часть 1): три верхние карточки стали НАПРАВЛЕНИЯМИ («Лендинг» /
// «Корпоративный сайт» / «Telegram-бот»), а не ступенями одной лестницы
// («шаблон → индивидуальный → корпоративный»), какими они были раньше.
// Полка внизу стала шестью маленькими карточками (было — три строки-ссылки
// плюс парная строка «поддержка/аудит»).
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
  /** Витринное имя карточки — НЕ имя ступени прайса. */
  showcaseName: string;
  price: string;
  /** Срок «от N дней» — решение владельца 2026-08-13, посчитано владельцем от
   *  часов соответствующей ступени `PRICING.md`, а не выведено кодом: часы
   *  сами на сайт не идут (см. `home/Hero.astro`, `priceFor()`), поэтому срок
   *  живёт здесь литералом, рядом с витринным именем карточки, а не
   *  вычисляется из `data/pricing.ts`. */
  timeframe: string;
  /** Глагол под конкретный товар для кнопки карточки — не «Заказать»
   *  (правка владельца 2026-08-13, часть 5). */
  cta: string;
  /** Состав, готовый к выводу списком — ровно пять пунктов на каждой
   *  карточке (правка владельца 2026-08-13, часть 4; проверено ниже). */
  composition: readonly string[];
  recommended?: {
    /** Единственная разрешённая метка спроса — «Самый популярный», дословно
     *  (отмена D-029 владельцем 2026-08-13, часть 2). Любая ДРУГАЯ метка
     *  спроса по-прежнему запрещена — см. сторож в `Pricing.markup.test.ts`. */
    label: string;
  };
}

const LANDING_CUSTOM = stage('Сайты', 'Лендинг с индивидуальным дизайном');
const SITE_5 = stage('Сайты', 'Сайт до 5 страниц');
const BOT_TASK = stage('Telegram', 'Бот под задачу');

if (!LANDING_CUSTOM.whatIncluded || !SITE_5.whatIncluded || !BOT_TASK.whatIncluded) {
  throw new Error('data/pricingShowcase.ts: у одной из трёх верхних ступеней нет состава (whatIncluded).');
}

/** Три верхние карточки — три НАПРАВЛЕНИЯ, не три ступени одной лестницы
 *  (правка владельца 2026-08-13, часть 1): «Лендинг» (Сайты → «Лендинг с
 *  индивидуальным дизайном»), «Корпоративный сайт» (Сайты → «Сайт до 5
 *  страниц», рекомендуемая) и «Telegram-бот» (Telegram → «Бот под задачу»).
 *  Ступень «Лендинг из шаблона» (15 000 ₽) переехала на полку — она больше не
 *  верхняя карточка. Сроки — решение владельца, не вывод из часов (см.
 *  `TopCard.timeframe`). */
export const TOP_CARDS: readonly TopCard[] = [
  {
    showcaseName: 'Лендинг',
    price: LANDING_CUSTOM.price,
    timeframe: 'от 5 дней',
    cta: 'Обсудить лендинг',
    // Состав ступени — четыре пункта дословно из PRICING.md (строка 49).
    // Пятый — «одна страница»: не пункт из `whatIncluded`, а граница объёма,
    // такая же, как у «Корпоративного сайта» была «до пяти страниц» в
    // прошлой версии карточки — «лендинг» по определению одностраничный,
    // это не отдельная выдуманная опция, а явное название объёма работы.
    composition: ['одна страница', ...splitComposition(LANDING_CUSTOM.whatIncluded)],
  },
  {
    showcaseName: 'Корпоративный сайт',
    price: SITE_5.price,
    timeframe: 'от 8 дней',
    cta: 'Обсудить сайт',
    // Накопительность: «Всё из «Лендинга»» — правда по составу ступеней
    // PRICING.md на уровне результата («Лендинг с индивидуальным дизайном»
    // уже даёт «дизайн с нуля»), поэтому «дизайн-система» из собственного
    // `whatIncluded` этой ступени (PRICING.md, строка 50) не повторяется
    // отдельным пунктом — она входит в «Всё из «Лендинга»». Остаются четыре
    // пункта, которых у «Лендинга» нет: навигация, формы, SEO-обвязка,
    // деплой. Итого пять пунктов — прежде чем удалить, свод считан отсюда же:
    // `filter` бросит в глаза, если «дизайн-система» когда-нибудь пропадёт
    // из источника (тогда фильтр не найдёт что убирать — тест ниже это ловит
    // по длине состава).
    composition: [
      'Всё из «Лендинга»',
      ...splitComposition(SITE_5.whatIncluded).filter((item) => item !== 'дизайн-система'),
    ],
    // Единственная разрешённая метка спроса — «Самый популярный», дословно.
    // Осознанная отмена D-029 владельцем 2026-08-13, часть 2 («Секция цен —
    // десять правок владельца»): раньше сайт не мог утверждать, что чего-то
    // заказывают чаще другого, — статистики продаж не существовало. Отмена
    // не снимает запрет вообще, а сужает его до этой ровно одной строки: см.
    // сторож в `Pricing.markup.test.ts` («Pricing.astro — сторож меток
    // спроса»), он остаётся и проверяет, что никакая ДРУГАЯ метка спроса
    // («хит продаж», «популярное», «выбор клиентов» и т.п.) на страницу не
    // просочилась.
    recommended: { label: 'Самый популярный' },
  },
  {
    showcaseName: 'Telegram-бот',
    price: BOT_TASK.price,
    timeframe: 'от 3 дней',
    cta: 'Обсудить бота',
    // Пять пунктов дословно из PRICING.md (строка 62) — состав уже ровно
    // пять, ничего не добавлено и не убрано.
    composition: splitComposition(BOT_TASK.whatIncluded),
  },
];

for (const card of TOP_CARDS) {
  if (card.composition.length !== 5) {
    throw new Error(
      `data/pricingShowcase.ts: у карточки «${card.showcaseName}» ${card.composition.length} ` +
      'пунктов состава — ожидалось ровно пять (правка владельца 2026-08-13, часть 4).',
    );
  }
}

export interface ShelfCard {
  label: string;
  price: string;
  href: string;
}

/** Полка — шесть маленьких карточек того же вида, что верхние (правка
 *  владельца 2026-08-13, часть 1), а не строки-ссылки: «Лендинг на готовом
 *  шаблоне» и «Бот-приёмщик заявок» — конкретные дешёвые ступени; «Автоматизация
 *  и интеграции» и «ИИ-консультант» — самая дешёвая числовая ступень своей
 *  группы (как и раньше); «Поддержка» и «Аудит сайта» — как было в прежней
 *  парной строке. Порядок — дословно по брифу владельца. Заголовок полки «И
 *  ещё три направления — коротко» удалён вместе со старой структурой. */
export const SHELF_CARDS: readonly ShelfCard[] = [
  {
    label: 'Лендинг на готовом шаблоне',
    price: stage('Сайты', 'Лендинг из шаблона').price,
    href: serviceHref('sites', 'Сайт под ключ'),
  },
  {
    label: 'Бот-приёмщик заявок',
    price: stage('Telegram', 'Бот-приёмщик заявок').price,
    href: serviceHref('telegram', 'Telegram-бот под задачу'),
  },
  {
    label: 'Автоматизация и интеграции',
    price: cheapestEntry(group('Автоматизация и интеграции')).price,
    href: serviceHref('automation', 'Приём заявок и интеграции'),
  },
  {
    label: 'ИИ-консультант',
    price: cheapestEntry(group('ИИ')).price,
    href: serviceHref('ai', 'ИИ-консультант по материалам'),
  },
  {
    label: 'Поддержка',
    price: stage('Поддержка', 'Пакет поддержки').price,
    href: serviceHref('sites', 'Доработка и поддержка'),
  },
  {
    label: 'Аудит сайта',
    price: stage('Сайты', 'Аудит сайта + план правок').price,
    href: serviceHref('sites', 'Аудит сайта'),
  },
];

if (SHELF_CARDS.length !== 6) {
  throw new Error(`data/pricingShowcase.ts: на полке ожидалось ровно шесть карточек, а их ${SHELF_CARDS.length}.`);
}

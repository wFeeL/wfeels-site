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

import { type PriceEntry, type PriceGroup } from './pricing';
import { priceEntry, priceGroup, compositionIndex } from './pricingLocalized';
import { assertParallel, type Locale } from '../i18n/locales';
import { serviceHref } from '../lib/serviceHref';

/* Витрина существует на двух языках и собирается ОДНИМ кодом. Ни одна
 * карточка не перечислена дважды: английская версия отличается только
 * текстовым слоем `SHOWCASE_TEXT` ниже, а цены, адреса, порядок и состав
 * приходят из того же прайса теми же вызовами. Потерять на английской
 * странице карточку, пункт состава или метку «Самый популярный» поэтому
 * нельзя — терять нечего, всё вычисляется.
 *
 * Ступени ищутся по РУССКИМ именам всегда: русское имя ступени — это её
 * идентификатор в `data/pricing.ts`, а не текст для читателя (разбор — в
 * `data/pricingLocalized.ts`). */

/** Ступень прайса на языке страницы, по русскому имени группы и ступени. */
function stage(locale: Locale, groupName: string, stageName: string): PriceEntry {
  return priceEntry(locale, groupName, stageName);
}

function group(locale: Locale, groupName: string): PriceGroup {
  return priceGroup(locale, groupName);
}

/** Состав ступени («что входит») дословно из PRICING.md, разбитый на пункты
 *  по запятой — так, как он и записан в источнике. Английский состав разбит
 *  на то же число кусков: это сторожит `data/pricingLocalized.ts` при
 *  загрузке модуля. */
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
 *  дешёвой ступенью раньше остальных в источнике.
 *
 *  Выбор делается по РУССКОМУ прайсу, а результат берётся тем же индексом из
 *  прайса нужного языка: сравнение цен не должно зависеть от того, как
 *  записана цена в переводе. Цифры там те же (сторож в
 *  `pricingLocalized.ts`), но выводить одну и ту же карточку двумя разными
 *  вычислениями — ровно тот способ, которым две версии страницы расходятся
 *  молча. */
function cheapestEntry(locale: Locale, groupName: string): PriceEntry {
  const ruGroup = group('ru', groupName);
  const numeric = ruGroup.entries
    .map((e, i) => ({ i, n: leadingRub(e.price) }))
    .filter((x): x is { i: number; n: number } => x.n !== null);
  if (numeric.length === 0) {
    throw new Error(`data/pricingShowcase.ts: в группе «${groupName}» нет ни одной числовой цены.`);
  }
  const cheapest = numeric.reduce((min, cur) => (cur.n < min.n ? cur : min));
  return group(locale, groupName).entries[cheapest.i];
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
  /** Ссылка на посадочную услуги — тем же приёмом, что `ShelfCard.href`
   *  (`serviceHref()`). Возвращена правкой 2026-08-26: временное решение
   *  владельца 2026-08-18 (карточки ведут к форме) действовало «до появления
   *  посадочных» (D-052) — посадочные исполнены (спека 03) и отвечают 200. */
  href: string;
  recommended?: {
    /** Единственная разрешённая метка спроса — «Самый популярный», дословно
     *  (отмена D-029 владельцем 2026-08-13, часть 2). Любая ДРУГАЯ метка
     *  спроса по-прежнему запрещена — см. сторож в `Pricing.markup.test.ts`. */
    label: string;
  };
}

export interface ShelfCard {
  label: string;
  /** Описание в строку-две — утверждено владельцем 2026-08-13 («Секция цен —
   *  полка малых карточек»), ставится дословно, не перефразируется. */
  description: string;
  price: string;
  /** Срок «от N дней» — решение владельца 2026-08-13, записано в
   *  `10-offer/PRICING.md` под соответствующей таблицей, тем же приёмом, что
   *  и `TopCard.timeframe`: срок не выводится из часов, а живёт литералом
   *  рядом с описанием карточки. `undefined` у «Поддержки» — она помесячная,
   *  срока у неё нет. */
  timeframe?: string;
  href: string;
}

/* ─────────────────────────── Текст витрины ────────────────────────────────
 *
 * Единственное, что различается между языками. Сроки («от 5 дней») здесь
 * тоже текст: число в них — решение владельца, записанное словами, а не
 * вычисление, и переводится в них только слово «дней».
 *
 * Пункт «одна страница» у «Лендинга» и «Все из «Лендинга»» у «Корпоративного
 * сайта» — тоже текст витрины, а не состав ступени: первое называет границу
 * объёма, второе объявляет накопительность. Оба обязаны быть переведены,
 * иначе на английской карточке останется русская строка посреди списка. */
interface TopCardText {
  showcaseName: string;
  timeframe: string;
  cta: string;
  /** Пункт, который витрина ДОБАВЛЯЕТ к составу ступени первым. */
  leadItem?: string;
  recommendedLabel?: string;
}

interface ShelfCardText {
  label: string;
  description: string;
  timeframe?: string;
}

interface ShowcaseText {
  top: readonly TopCardText[];
  shelf: readonly ShelfCardText[];
}

const SHOWCASE_TEXT: Record<Locale, ShowcaseText> = {
  ru: {
    top: [
      { showcaseName: 'Лендинг', timeframe: 'от 5 дней', cta: 'Обсудить лендинг', leadItem: 'одна страница' },
      {
        showcaseName: 'Корпоративный сайт', timeframe: 'от 8 дней', cta: 'Обсудить сайт',
        leadItem: 'Все из «Лендинга»', recommendedLabel: 'Самый популярный',
      },
      { showcaseName: 'Telegram-бот', timeframe: 'от 3 дней', cta: 'Обсудить бота' },
    ],
    shelf: [
      {
        label: 'Лендинг на готовом шаблоне',
        description: 'Готовый шаблон под ваш контент. Быстрее и дешевле всего, если тексты и фото уже есть.',
        timeframe: 'от 2 дней',
      },
      {
        label: 'Бот-приемщик заявок',
        description: 'Один сценарий: клиент пишет боту, заявка падает вам в уведомления. Без админки.',
        timeframe: 'от 2 дней',
      },
      {
        label: 'Автоматизация и интеграции',
        description: 'Связать форму с CRM, подключить оплату, выгрузить заявки в таблицу.',
        timeframe: 'от 2 дней',
      },
      {
        label: 'ИИ-консультант',
        description: 'Отвечает клиентам по вашим материалам, ссылается на источник и честно говорит, когда ответа в них нет.',
        timeframe: 'от 3 дней',
      },
      {
        label: 'Поддержка',
        description: 'Пять часов в месяц на правки и присмотр. Неиспользованное частично переносится.',
      },
      {
        label: 'Аудит сайта',
        description: 'Разбор структуры, скорости, мобильной версии и форм. На выходе — список проблем по приоритету.',
        timeframe: 'от 1 дня',
      },
    ],
  },
  en: {
    top: [
      { showcaseName: 'Landing page', timeframe: 'from 5 days', cta: 'Discuss a landing page', leadItem: 'one page' },
      {
        showcaseName: 'Company website', timeframe: 'from 8 days', cta: 'Discuss a website',
        leadItem: 'Everything in “Landing page”', recommendedLabel: 'Most popular',
      },
      { showcaseName: 'Telegram bot', timeframe: 'from 3 days', cta: 'Discuss a bot' },
    ],
    shelf: [
      {
        label: 'Landing page on a ready template',
        description: 'A ready template filled with your content. The fastest and cheapest option when the text and photos already exist.',
        timeframe: 'from 2 days',
      },
      {
        label: 'Enquiry intake bot',
        description: 'One flow: the client writes to the bot, the enquiry lands in your notifications. No admin panel.',
        timeframe: 'from 2 days',
      },
      {
        label: 'Automation and integrations',
        description: 'Connect a form to your CRM, add payments, export enquiries to a spreadsheet.',
        timeframe: 'from 2 days',
      },
      {
        label: 'AI consultant',
        description: 'Answers your clients’ questions from your materials, points at the source, and says honestly when the answer isn’t in them.',
        timeframe: 'from 3 days',
      },
      {
        label: 'Support',
        description: 'Five hours a month for changes and keeping an eye on things. Unused time partly carries over.',
      },
      {
        label: 'Website audit',
        description: 'A review of structure, speed, the mobile version and the forms. You get a list of problems in priority order.',
        timeframe: 'from 1 day',
      },
    ],
  },
};

assertParallel('data/pricingShowcase.ts (верхние карточки)', {
  ru: SHOWCASE_TEXT.ru.top, en: SHOWCASE_TEXT.en.top,
});
assertParallel('data/pricingShowcase.ts (полка)', {
  ru: SHOWCASE_TEXT.ru.shelf, en: SHOWCASE_TEXT.en.shelf,
});

/* Метка спроса и срок обязаны быть либо на обоих языках, либо ни на одном:
   карточка без срока на английской версии и со сроком на русской — это уже
   две разных карточки, а не одна на двух языках. */
SHOWCASE_TEXT.ru.top.forEach((ru, i) => {
  const en = SHOWCASE_TEXT.en.top[i];
  if (Boolean(ru.recommendedLabel) !== Boolean(en.recommendedLabel)) {
    throw new Error(
      `data/pricingShowcase.ts: метка спроса у карточки «${ru.showcaseName}» стоит ` +
      'только на одном языке.',
    );
  }
  if (Boolean(ru.leadItem) !== Boolean(en.leadItem)) {
    throw new Error(
      `data/pricingShowcase.ts: добавленный пункт состава у карточки «${ru.showcaseName}» ` +
      'есть только на одном языке — списки состава разойдутся на пункт.',
    );
  }
});
SHOWCASE_TEXT.ru.shelf.forEach((ru, i) => {
  const en = SHOWCASE_TEXT.en.shelf[i];
  if (Boolean(ru.timeframe) !== Boolean(en.timeframe)) {
    throw new Error(
      `data/pricingShowcase.ts: срок карточки полки «${ru.label}» стоит только на ` +
      'одном языке.',
    );
  }
});

/** Три верхние карточки — три НАПРАВЛЕНИЯ, не три ступени одной лестницы
 *  (правка владельца 2026-08-13, часть 1): «Лендинг» (Сайты → «Лендинг с
 *  индивидуальным дизайном»), «Корпоративный сайт» (Сайты → «Сайт до 5
 *  страниц», рекомендуемая) и «Telegram-бот» (Telegram → «Бот под задачу»).
 *  Ступень «Лендинг из шаблона» (15 000 ₽) переехала на полку — она больше не
 *  верхняя карточка. Сроки — решение владельца, не вывод из часов (см.
 *  `TopCard.timeframe`). */
export function topCards(locale: Locale): readonly TopCard[] {
  const text = SHOWCASE_TEXT[locale].top;
  const landing = stage(locale, 'Сайты', 'Лендинг с индивидуальным дизайном');
  const site5 = stage(locale, 'Сайты', 'Сайт до 5 страниц');
  const bot = stage(locale, 'Telegram', 'Бот под задачу');

  if (!landing.whatIncluded || !site5.whatIncluded || !bot.whatIncluded) {
    throw new Error('data/pricingShowcase.ts: у одной из трёх верхних ступеней нет состава (whatIncluded).');
  }

  /* «Дизайн-система» снимается из состава «Сайта до 5 страниц» по НОМЕРУ
     куска, а номер вычисляется по русскому составу: пункт входит в «Все из
     «Лендинга»» и не повторяется отдельной строкой. Поиск по слову работал
     бы только на русском — на английской карточке фильтр не нашёл бы ничего
     и молча оставил бы шестой пункт там, где их обязано быть пять.
     `compositionIndex` роняет сборку, если куска нет и в русском составе. */
  const dropIndex = compositionIndex('Сайт до 5 страниц', 'Сайты', 'дизайн-система');

  // «Лендинг» и «Корпоративный сайт» — два тарифа ОДНОЙ посадочной (S1,
  // /services/website: страница несёт обе ступени в своей сетке цен, см.
  // `data/servicePages.ts`, `tiers`). «Telegram-бот» — своя посадочная S8.
  const websiteHref = serviceHref('sites', 'Сайт под ключ');
  const botHref = serviceHref('telegram', 'Telegram-бот под задачу');

  const cards: TopCard[] = [
    {
      showcaseName: text[0].showcaseName,
      price: landing.price,
      timeframe: text[0].timeframe,
      cta: text[0].cta,
      // Состав ступени — четыре пункта дословно из PRICING.md (строка 49).
      // Пятый — «одна страница»: не пункт из `whatIncluded`, а граница объёма
      // («лендинг» по определению одностраничный), поэтому живёт в тексте
      // витрины и переводится вместе с ней.
      composition: [text[0].leadItem!, ...splitComposition(landing.whatIncluded)],
      href: websiteHref,
    },
    {
      showcaseName: text[1].showcaseName,
      price: site5.price,
      timeframe: text[1].timeframe,
      cta: text[1].cta,
      // Накопительность: «Все из «Лендинга»» — правда по составу ступеней
      // PRICING.md на уровне результата, поэтому «дизайн-система» из
      // собственного `whatIncluded` этой ступени не повторяется отдельным
      // пунктом. Остаются четыре пункта: навигация, формы, SEO-обвязка,
      // деплой. Итого пять.
      composition: [
        text[1].leadItem!,
        ...splitComposition(site5.whatIncluded).filter((_, i) => i !== dropIndex),
      ],
      // Единственная разрешённая метка спроса — «Самый популярный», дословно.
      // Осознанная отмена D-029 владельцем 2026-08-13, часть 2. Отмена не
      // снимает запрет вообще, а сужает его до этой ровно одной строки: см.
      // сторож в `Pricing.markup.test.ts`.
      recommended: { label: text[1].recommendedLabel! },
      href: websiteHref,
    },
    {
      showcaseName: text[2].showcaseName,
      price: bot.price,
      timeframe: text[2].timeframe,
      cta: text[2].cta,
      // Пять пунктов дословно из PRICING.md (строка 62) — состав уже ровно
      // пять, ничего не добавлено и не убрано.
      composition: splitComposition(bot.whatIncluded),
      href: botHref,
    },
  ];

  for (const card of cards) {
    if (card.composition.length !== 5) {
      throw new Error(
        `data/pricingShowcase.ts: у карточки «${card.showcaseName}» ${card.composition.length} ` +
        `пунктов состава (${locale}) — ожидалось ровно пять (правка владельца 2026-08-13, часть 4).`,
      );
    }
  }
  return cards;
}

/** Полка — шесть маленьких карточек того же вида, что верхние (правка
 *  владельца 2026-08-13, часть 1), а не строки-ссылки: «Лендинг на готовом
 *  шаблоне» и «Бот-приёмщик заявок» — конкретные дешёвые ступени; «Автоматизация
 *  и интеграции» и «ИИ-консультант» — самая дешёвая числовая ступень своей
 *  группы (как и раньше); «Поддержка» и «Аудит сайта» — как было в прежней
 *  парной строке. Порядок — дословно по брифу владельца. */
export function shelfCards(locale: Locale): readonly ShelfCard[] {
  const text = SHOWCASE_TEXT[locale].shelf;
  const prices: string[] = [
    stage(locale, 'Сайты', 'Лендинг из шаблона').price,
    stage(locale, 'Telegram', 'Бот-приемщик заявок').price,
    cheapestEntry(locale, 'Автоматизация и интеграции').price,
    cheapestEntry(locale, 'ИИ').price,
    stage(locale, 'Поддержка', 'Пакет поддержки').price,
    stage(locale, 'Сайты', 'Аудит сайта + план правок').price,
  ];
  const hrefs: string[] = [
    serviceHref('sites', 'Сайт под ключ'),
    serviceHref('telegram', 'Telegram-бот под задачу'),
    serviceHref('automation', 'Прием заявок и интеграции'),
    serviceHref('ai', 'ИИ-консультант по материалам'),
    serviceHref('sites', 'Доработка и поддержка'),
    serviceHref('sites', 'Аудит сайта'),
  ];

  const cards = text.map((t, i) => ({
    label: t.label,
    description: t.description,
    price: prices[i],
    timeframe: t.timeframe,
    href: hrefs[i],
  }));

  if (cards.length !== 6) {
    throw new Error(`data/pricingShowcase.ts: на полке ожидалось ровно шесть карточек, а их ${cards.length}.`);
  }
  return cards;
}

/** Русская витрина под прежними именами — на неё смотрят тесты и всё, чему
 *  язык страницы не важен. Обе версии собираются одним и тем же кодом, так
 *  что эти константы не второй перечень, а вызов той же функции. */
export const TOP_CARDS: readonly TopCard[] = topCards('ru');
export const SHELF_CARDS: readonly ShelfCard[] = shelfCards('ru');

/* Обе версии витрины собираются на загрузке модуля, а не при первом
   обращении со страницы: сторожа выше (пять пунктов состава, шесть карточек
   полки, наличие ступени в прайсе) обязаны сработать на СБОРКЕ, в том числе
   для языка, страницу которого сегодня никто не открыл. */
topCards('en');
shelfCards('en');

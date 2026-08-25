// РУЧНОЙ ФАЙЛ — заведён по образцу `data/pricing.ts`, но НЕ генерируется.
//
// Источник — 10-offer/SERVICES.md, единственный источник сроков сайта. Цены
// живут в `data/pricing.ts` и генерируются оттуда отдельно (`10-offer/PRICING.md`).
//
// Долг перед базой: у сроков пока нет генератора — `70-workshop/tools/
// generate_pricing.py` читает только PRICING.md. Расширить его так, чтобы он
// писал и терма из SERVICES.md, — отдельная задача базы, не этого плана
// (`70-workshop/plans/site-v3/02-home-plan.md`, задача 5). До тех пор при
// правке срока в SERVICES.md проверять этот файл руками — второе место, о
// котором легко забыть.
//
// Дисциплина та же, что у сгенерированного файла: у каждой записи — `source`
// (строка SERVICES.md, откуда взято число), и разметка секций сайта эти
// числа не хранит — только читает отсюда.

/** Один срок таблицы первого экрана. */
import { assertParallel, type Locale } from '../i18n/locales';

export interface TermEntry {
  /** Название группы — как в таблице первого экрана (спека 02-texts.md,
   *  секция 1). Дословно совпадает с меткой соответствующей строки. */
  label: string;
  /** Срок «от», дословно из SERVICES.md. */
  term: string;
  /** Услуга и строка SERVICES.md, откуда взято число. */
  source: string;
}

/** Дата, когда этот файл в последний раз сверен с SERVICES.md руками. */
export const CHECKED_AT = '2026-08-12';

/** Четыре строки таблицы первого экрана, в порядке спеки 02-texts.md,
 *  секция 1, плюс аудит сайта — указание владельца 2026-08-26: «основной
 *  вход в воронку» по SERVICES.md стоял только шестой карточкой полки цен и
 *  отсутствовал на первом экране. */
export const HERO_TERMS: readonly TermEntry[] = [
  {
    label: 'Сайты и лендинги',
    term: 'от 2–4 дней',
    source:
      'SERVICES.md:27 — услуга S1 «Сайт под ключ», строка «Срок: от 2–4 дней ' +
      '(шаблон) до 2–3 недель (10 страниц). От 15 000 ₽.»',
  },
  {
    label: 'Автоматизация и интеграции',
    /* Было «от 1–3 дней» — расходилось с решением владельца 2026-08-13
       (PRICING.md) и с карточкой цен той же страницы («от 2 дней»): сайт
       спорил сам с собой на расстоянии одного экрана. Нижняя граница 1 → 2,
       правка 2026-08-26; верхняя (3) не тронута — она вынесена отдельным
       вопросом владельцу. */
    term: 'от 2–3 дней',
    source:
      'PRICING.md:101–102 — раздел «Ступени услуг → Backend и автоматизация», ' +
      'строка «Календарные сроки — решение владельца 2026-08-13: аудит сайта ' +
      '— от 1 дня; одна интеграция — от 2 дней.»',
  },
  {
    label: 'ИИ-консультант',
    term: 'от 3–5 дней',
    source:
      'SERVICES.md:64 — услуга S4 «ИИ-консультант по материалам бизнеса», ' +
      'строка «Срок: 3–5 дней (готовые материалы) — 1–2 недели (со сбором). ' +
      'От 18 000 ₽.»',
  },
  {
    // Четвёртая строка — указание владельца 2026-08-26 (см. комментарий
    // над HERO_TERMS). Срок и цена дословно из PRICING.md, не SERVICES.md:
    // аудит числится там же, где цена (`data/pricing.ts` уже читает эту
    // ступень из группы «Сайты» — `home/Hero.astro`, `priceFor()`).
    label: 'Аудит сайта',
    term: 'от 1 дня',
    source:
      'PRICING.md:101 — раздел «Ступени услуг → Backend и автоматизация», ' +
      'строка «Календарные сроки — решение владельца 2026-08-13: аудит сайта ' +
      '— от 1 дня; одна интеграция — от 2 дней.»',
  },
];

/* ─────────────────────────── Английская версия ────────────────────────────
 *
 * Собирается из русской: `source` — цитата из `10-offer/SERVICES.md`, и она
 * остаётся русской намеренно. Цитата с переведёнными словами перестаёт быть
 * цитатой, а поле `source` существует ровно затем, чтобы к нему можно было
 * вернуться и сверить строку с документом базы.
 *
 * Сам срок («от 2–4 дней») переводится словом, но не числом: диапазон тот же,
 * тире то же. */
interface TermText {
  label: string;
  term: string;
}

const TERM_TEXT_EN: readonly TermText[] = [
  { label: 'Websites and landing pages', term: 'from 2–4 days' },
  { label: 'Automation and integrations', term: 'from 2–3 days' },
  { label: 'AI consultant', term: 'from 3–5 days' },
  { label: 'Website audit', term: 'from 1 day' },
];

const HERO_TERMS_EN: readonly TermEntry[] = HERO_TERMS.map((entry, i) => {
  const text = TERM_TEXT_EN[i];
  if (!text) {
    throw new Error(
      `data/terms.ts: у срока «${entry.label}» нет английской подписи — таблица ` +
      'первого экрана обязана нести те же четыре строки на обоих языках.',
    );
  }
  const digits = (value: string) => value.replace(/\D+/g, '');
  if (digits(text.term) !== digits(entry.term)) {
    throw new Error(
      `data/terms.ts: английский срок «${text.term}» несёт другие цифры, чем ` +
      `русский «${entry.term}». Переводится слово вокруг числа, не само число: ` +
      'сроки приходят из 10-offer/SERVICES.md.',
    );
  }
  return { ...entry, label: text.label, term: text.term };
});

const TERMS_BY_LOCALE: Record<Locale, readonly TermEntry[]> = {
  ru: HERO_TERMS, en: HERO_TERMS_EN,
};
assertParallel('data/terms.ts', TERMS_BY_LOCALE);

export function heroTerms(locale: Locale): readonly TermEntry[] {
  return TERMS_BY_LOCALE[locale];
}

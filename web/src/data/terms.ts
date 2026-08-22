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

/** Три строки таблицы первого экрана, в порядке спеки 02-texts.md, секция 1. */
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
    term: 'от 1–3 дней',
    source:
      'SERVICES.md:80 — услуга S5 «Приём заявок и интеграции», строка ' +
      '«Срок: 1–3 дня на интеграцию. От 7 500 ₽.»',
  },
  {
    label: 'ИИ-консультант',
    term: 'от 3–5 дней',
    source:
      'SERVICES.md:64 — услуга S4 «ИИ-консультант по материалам бизнеса», ' +
      'строка «Срок: 3–5 дней (готовые материалы) — 1–2 недели (со сбором). ' +
      'От 18 000 ₽.»',
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
  { label: 'Automation and integrations', term: 'from 1–3 days' },
  { label: 'AI consultant', term: 'from 3–5 days' },
];

const HERO_TERMS_EN: readonly TermEntry[] = HERO_TERMS.map((entry, i) => {
  const text = TERM_TEXT_EN[i];
  if (!text) {
    throw new Error(
      `data/terms.ts: у срока «${entry.label}» нет английской подписи — таблица ` +
      'первого экрана обязана нести те же три строки на обоих языках.',
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

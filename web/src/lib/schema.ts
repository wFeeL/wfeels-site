import type { Locale } from '../i18n/locales';

/** Имя бренда. Одно на разметку и на знак; домен и настоящее имя приходят
 *  перед публикацией ([[00-overview]], раздел 11). */
const BRAND = 'wfeels';

export type SchemaKind = 'website' | 'contact';

export interface SchemaContext {
  /** Корень сайта, абсолютный. */
  site: string;
  /** Канонический адрес самой страницы. */
  canonical: string;
  title: string;
  description: string;
  lang: Locale;
}

/** Структурированная разметка страницы.
 *
 *  Здесь только то, что можно подтвердить самой страницей: имя бренда, адрес,
 *  язык, заголовок и описание. Ни адреса, ни телефона, ни организации —
 *  выдуманные реквизиты в разметке были бы той же неправдой, что и в тексте,
 *  только машиночитаемой. */
export function pageSchema(kind: SchemaKind, ctx: SchemaContext) {
  const site = ctx.site.replace(/\/$/, '');
  const website = { '@type': 'WebSite', name: BRAND, url: site };

  if (kind === 'website') {
    return {
      '@context': 'https://schema.org',
      ...website,
      inLanguage: ctx.lang,
      description: ctx.description,
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: ctx.title,
    description: ctx.description,
    url: ctx.canonical,
    inLanguage: ctx.lang,
    isPartOf: website,
  };
}

export interface FaqEntry {
  question: string;
  /** Ответ как есть, включая `**слово**` разметки полужирного из
   *  `data/faq.ts` — `faqPageSchema` сама снимает эти маркеры: `text` в
   *  `Answer` schema.org читает как обычный текст, а не HTML/Markdown. */
  answer: string;
}

/** Разметка `FAQPage` секции 10. Ровно один экземпляр на странице (план
 *  `02-home-plan.md`, задача 12): на главной уже есть блок `website`
 *  (`pageSchema('website', …)` выше) — два блока `ld+json` допустимы, два
 *  `FAQPage` нет. Второй перечень вопросов здесь не заводится — читает
 *  `items`, тот же массив, что рисует разметку секции. */
export function faqPageSchema(items: readonly FaqEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer.replace(/\*\*/g, ''),
      },
    })),
  };
}

/** JSON для вставки внутрь `<script type="application/ld+json">`.
 *
 *  Разборщик HTML ищет в содержимом скрипта закрывающий тег и не знает ничего
 *  про JSON: строка `</script>` внутри значения оборвала бы скрипт и высыпала
 *  остаток разметки в страницу. Экранированная последовательность `<`
 *  разбирается JSON как обычная «<» и невидима для разборщика HTML. */
export function serializeSchema(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003C');
}

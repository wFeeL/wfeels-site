import type { Locale } from '../i18n/locales';

/** Имя бренда. Одно на разметку и на знак; домен и настоящее имя приходят
 *  перед публикацией ([[00-overview]], раздел 11). */
const BRAND = 'wfeels';
const PROVIDER_NAME = 'Сабуров Даниил Денисович';
const PROVIDER_EMAIL = 'i@dsaburov.ru';
const PROVIDER_TELEGRAM = 'https://t.me/wfeels';

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

/** Подтверждённый исполнитель, общий для сайта, контактов, услуг и кейсов.
 *  Здесь нет рейтинга, отзывов, телефона, офиса или наград: сайт этих фактов
 *  не подтверждает. Санкт-Петербург уже публично указан как город работы,
 *  но физический адрес не публикуется, поэтому LocalBusiness не используется. */
export function providerSchema(site: string) {
  const root = site.replace(/\/$/, '');
  return {
    '@type': 'Person',
    '@id': `${root}/#person`,
    name: PROVIDER_NAME,
    url: root,
    email: `mailto:${PROVIDER_EMAIL}`,
    jobTitle: 'Веб-разработчик',
    sameAs: [PROVIDER_TELEGRAM],
  };
}

/** Структурированная разметка страницы.
 *
 *  Здесь только то, что можно подтвердить самой страницей: имя бренда, адрес,
 *  язык, заголовок и описание. Ни адреса, ни телефона, ни организации —
 *  выдуманные реквизиты в разметке были бы той же неправдой, что и в тексте,
 *  только машиночитаемой. */
export function pageSchema(kind: SchemaKind, ctx: SchemaContext) {
  const site = ctx.site.replace(/\/$/, '');
  const provider = providerSchema(site);
  const website = {
    '@type': 'WebSite',
    '@id': `${site}/#website`,
    name: BRAND,
    url: site,
    author: { '@id': provider['@id'] },
  };

  if (kind === 'website') {
    return {
      '@context': 'https://schema.org',
      ...website,
      inLanguage: ctx.lang,
      description: ctx.description,
      creator: provider,
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
    mainEntity: provider,
  };
}

export interface ServiceSchemaContext extends SchemaContext {
  name: string;
  serviceType: string;
}

/** Машиночитаемое описание посадочной услуги без выдуманного Offer.
 *  Цены на сайте ориентировочные «от», а итог закрепляется договором, поэтому
 *  агрегировать их в фиксированное предложение schema.org было бы шире
 *  публичных условий. */
export function serviceSchema(ctx: ServiceSchemaContext) {
  const site = ctx.site.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${ctx.canonical}#service`,
    name: ctx.name,
    serviceType: ctx.serviceType,
    description: ctx.description,
    url: ctx.canonical,
    inLanguage: ctx.lang,
    provider: providerSchema(site),
    termsOfService: `${site}/terms`,
  };
}

export interface CollectionItem {
  name: string;
  url: string;
}

/** Каталог страниц: ItemList перечисляет только реально существующие URL и
 *  получает порядок из тех же данных, что визуальная сетка. */
export function collectionPageSchema(
  ctx: SchemaContext,
  items: readonly CollectionItem[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${ctx.canonical}#collection`,
    name: ctx.title,
    description: ctx.description,
    url: ctx.canonical,
    inLanguage: ctx.lang,
    isPartOf: { '@type': 'WebSite', '@id': `${ctx.site.replace(/\/$/, '')}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: item.url,
      })),
    },
  };
}

export interface CaseStudySchemaContext extends SchemaContext {
  name: string;
  about: string;
}

/** Кейсы описываются как CreativeWork, а не отзыв или выполненный заказ:
 *  часть портфолио — собственные демонстрационные продукты, и превращать их
 *  в несуществующие клиентские истории нельзя. */
export function caseStudySchema(ctx: CaseStudySchemaContext) {
  const site = ctx.site.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    '@id': `${ctx.canonical}#case`,
    name: ctx.name,
    headline: ctx.title,
    description: ctx.description,
    about: ctx.about,
    url: ctx.canonical,
    inLanguage: ctx.lang,
    author: providerSchema(site),
    isPartOf: { '@type': 'WebSite', '@id': `${site}/#website` },
  };
}

export interface FaqEntry {
  question: string;
  /** Ответ как есть, включая возможную `**слово**` разметку полужирного —
   *  `faqPageSchema` сама снимает эти маркеры: `text` в `Answer` schema.org
   *  читает как обычный текст, а не HTML/Markdown. */
  answer: string;
}

/** Разметка `FAQPage` для утвержденного списка вопросов услуги. Главная ее
 *  намеренно не выпускает: для коммерческого портфолио FAQ rich results
 *  Google не показывает. Второй перечень вопросов не заводится — функция
 *  читает тот же массив, который рисует компонент услуги. */
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

export interface BreadcrumbItem {
  text: string;
  /** Отсутствует у последнего элемента — текущей страницы. */
  href?: string;
}

/** Разметка `BreadcrumbList` хлебных крошек (`Breadcrumbs.astro`) — спека
 *  `70-workshop/specs/site-v3/08-service-pages.md`, раздел 6. Единственный
 *  тип структурированных данных, который посадочная подтверждает целиком
 *  сама собой (реально существующей навигацией), поэтому он единственный,
 *  что выпускается на страницах услуг (раздел 11.4).
 *
 *  Адреса — абсолютные: `site` приходит от `Astro.site` вызывающей
 *  страницы, тем же приёмом, что `pageSchema` берёт `ctx.site` выше.
 *  Последний элемент (без `href`) не получает `item` — у текущей страницы
 *  в `BreadcrumbList` адрес не обязателен (schema.org, `ListItem`), а
 *  выдумывать его из `canonical`, которого сюда не передали, было бы вторым
 *  источником того же адреса. */
export function breadcrumbSchema(items: readonly BreadcrumbItem[], site: string) {
  const base = site.replace(/\/$/, '');
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.text,
      ...(item.href ? { item: `${base}${item.href}` } : {}),
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

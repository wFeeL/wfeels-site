import { describe, it, expect } from 'vitest';
import {
  pageSchema,
  serializeSchema,
  faqPageSchema,
  breadcrumbSchema,
  providerSchema,
  serviceSchema,
  collectionPageSchema,
  caseStudySchema,
} from './schema';

const INPUT = {
  site: 'https://example.com',
  canonical: 'https://example.com/contact',
  title: 'Контакты — wfeels',
  description: 'Расскажите о задаче.',
  lang: 'ru' as const,
};

describe('pageSchema', () => {
  it('сайт целиком описан как WebSite и указывает на корень', () => {
    const data = pageSchema('website', { ...INPUT, canonical: INPUT.site });
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('WebSite');
    expect(data.url).toBe('https://example.com');
    expect(data.inLanguage).toBe('ru');
    expect(data.creator['@type']).toBe('Person');
    expect(data.creator.name).toBe('Сабуров Даниил Денисович');
  });

  it('язык берётся у страницы, а не у сайта', () => {
    const data = pageSchema('website', { ...INPUT, lang: 'en' });
    expect(data.inLanguage).toBe('en');
  });

  it('страница контактов описана как ContactPage и привязана к сайту', () => {
    const data = pageSchema('contact', INPUT) as Record<string, any>;
    expect(data['@type']).toBe('ContactPage');
    expect(data.url).toBe(INPUT.canonical);
    expect(data.name).toBe(INPUT.title);
    expect(data.isPartOf).toEqual({
      '@type': 'WebSite',
      '@id': 'https://example.com/#website',
      name: 'wfeels',
      url: 'https://example.com',
      author: { '@id': 'https://example.com/#person' },
    });
    expect(data.mainEntity['@id']).toBe('https://example.com/#person');
  });
});

describe('providerSchema', () => {
  it('несёт только подтверждённую личность и публичные контакты', () => {
    const data = providerSchema('https://example.com/');
    expect(data['@type']).toBe('Person');
    expect(data['@id']).toBe('https://example.com/#person');
    expect(data.email).toBe('mailto:i@dsaburov.ru');
    expect(data.sameAs).toEqual(['https://t.me/wfeels']);
    expect(data).not.toHaveProperty('telephone');
    expect(data).not.toHaveProperty('aggregateRating');
  });
});

describe('serviceSchema', () => {
  it('описывает услугу и исполнителя, но не выдумывает фиксированный Offer', () => {
    const data = serviceSchema({
      ...INPUT,
      canonical: 'https://example.com/services/website',
      name: 'Сайт под ключ',
      serviceType: 'Разработка сайтов',
    });
    expect(data['@type']).toBe('Service');
    expect(data.provider['@type']).toBe('Person');
    expect(data.termsOfService).toBe('https://example.com/terms');
    expect(data).not.toHaveProperty('offers');
  });
});

describe('collectionPageSchema', () => {
  it('выводит ItemList из переданных существующих страниц', () => {
    const data = collectionPageSchema(INPUT, [
      { name: 'Сайты', url: 'https://example.com/services/website' },
      { name: 'Боты', url: 'https://example.com/services/telegram-bot' },
    ]);
    expect(data['@type']).toBe('CollectionPage');
    expect(data.mainEntity['@type']).toBe('ItemList');
    expect(data.mainEntity.itemListElement.map((i) => i.position)).toEqual([1, 2]);
  });
});

describe('caseStudySchema', () => {
  it('описывает доказательство как CreativeWork, а не клиентский отзыв', () => {
    const data = caseStudySchema({
      ...INPUT,
      canonical: 'https://example.com/cases/site-v3',
      name: 'Этот сайт',
      about: 'Разработка сайта-портфолио',
    });
    expect(data['@type']).toBe('CreativeWork');
    expect(data.author['@type']).toBe('Person');
    expect(data).not.toHaveProperty('review');
    expect(data).not.toHaveProperty('aggregateRating');
  });
});

describe('faqPageSchema', () => {
  const ITEMS = [
    { question: 'Вопрос один?', answer: 'Ответ **с полужирным** словом.' },
    { question: 'Вопрос два?', answer: 'Обычный ответ.' },
  ];

  it('тип FAQPage, по одной Question на вопрос', () => {
    const data = faqPageSchema(ITEMS);
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity).toHaveLength(2);
    expect(data.mainEntity[0]['@type']).toBe('Question');
    expect(data.mainEntity[0].name).toBe('Вопрос один?');
    expect(data.mainEntity[0].acceptedAnswer['@type']).toBe('Answer');
  });

  it('маркеры полужирного «**» снимаются в тексте ответа schema.org', () => {
    const data = faqPageSchema(ITEMS);
    expect(data.mainEntity[0].acceptedAnswer.text).toBe('Ответ с полужирным словом.');
    expect(data.mainEntity[0].acceptedAnswer.text).not.toContain('**');
  });
});

describe('breadcrumbSchema', () => {
  const ITEMS = [
    { text: 'Главная', href: '/' },
    { text: 'Услуги', href: '/services' },
    { text: 'Сайт под ключ' },
  ];

  it('тип BreadcrumbList, позиции по порядку с единицы', () => {
    const data = breadcrumbSchema(ITEMS, 'https://example.com');
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('BreadcrumbList');
    expect(data.itemListElement).toHaveLength(3);
    expect(data.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(data.itemListElement.map((i) => i.name)).toEqual([
      'Главная', 'Услуги', 'Сайт под ключ',
    ]);
  });

  it('адреса абсолютные, склеены с сайтом без двойного слеша', () => {
    const data = breadcrumbSchema(ITEMS, 'https://example.com/');
    expect(data.itemListElement[0].item).toBe('https://example.com/');
    expect(data.itemListElement[1].item).toBe('https://example.com/services');
  });

  it('последний элемент — текущая страница — без item', () => {
    const data = breadcrumbSchema(ITEMS, 'https://example.com');
    expect(data.itemListElement[2].item).toBeUndefined();
  });
});

describe('serializeSchema', () => {
  // Разметка кладётся внутрь <script> как есть. Любая закрывающая скобка тега в
  // тексте оборвала бы скрипт и высыпала остаток JSON в страницу — поэтому `<`
  // уезжает экранированной последовательностью, которую JSON понимает, а
  // разборщик HTML — нет.
  it('закрывающий тег внутри текста не может оборвать скрипт', () => {
    const out = serializeSchema({ name: 'a </script><b>b' });
    expect(out).not.toContain('</script>');
    expect(JSON.parse(out).name).toBe('a </script><b>b');
  });

  it('обычные данные остаются читаемым JSON', () => {
    expect(JSON.parse(serializeSchema({ '@type': 'WebSite' }))['@type'])
      .toBe('WebSite');
  });
});

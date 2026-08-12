import { describe, it, expect } from 'vitest';
import { pageSchema, serializeSchema, faqPageSchema } from './schema';

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
      name: 'wfeels',
      url: 'https://example.com',
    });
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

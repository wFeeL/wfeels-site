import { describe, it, expect } from 'vitest';
import { CASES, homeCases, CASES_CATALOG_HREF, FACTORY_TEASER } from './cases';

describe('cases.ts — внутренняя целостность', () => {
  it('шесть кейсов всего (00-overview.md)', () => {
    expect(CASES.length).toBe(6);
  });

  it('ровно три кейса на главной', () => {
    expect(homeCases().length).toBe(3);
  });

  it('три кейса главной в порядке, зеркалящем таблицу первого экрана: ' +
    'этот сайт → Заявка-Хаб → ИИ-консультант', () => {
    expect(homeCases().map((c) => c.title)).toEqual([
      'Этот сайт', 'Заявка-Хаб', 'ИИ-консультант',
    ]);
  });

  it('у каждого кейса главной есть описание и строка стека', () => {
    for (const c of homeCases()) {
      expect(c.description, c.title).toBeTruthy();
      expect(c.stack, c.title).toBeTruthy();
    }
  });

  it('строка стека — латиницей, без кириллицы', () => {
    const cyrillic = /[а-яА-ЯёЁ]/;
    for (const c of homeCases()) {
      expect(cyrillic.test(c.stack ?? ''), `«${c.title}»: «${c.stack}»`).toBe(false);
    }
  });

  it('слова «клиент», «заказчик», «для компании» не встречаются в описаниях', () => {
    // Отрицательный просмотр вперёд отсекает «клиентский» (прилагательное,
    // как в служебных комментариях про «клиентский бандл») — запрещено
    // именно существительное «клиент» в падежных формах, не однокоренное
    // прилагательное.
    const forbidden = /клиент(?!ск)|заказчик|для компании/i;
    for (const c of CASES) {
      if (!c.description) continue;
      expect(forbidden.test(c.description), `«${c.title}»: «${c.description}»`).toBe(false);
    }
    expect(forbidden.test(FACTORY_TEASER.title)).toBe(false);
    expect(forbidden.test(FACTORY_TEASER.text)).toBe(false);
  });

  it('адреса кейсов уникальны', () => {
    const slugs = CASES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('каталог кейсов ведёт на /cases', () => {
    expect(CASES_CATALOG_HREF).toBe('/cases');
  });

  it('тизер фабрики ведёт на страницу кейса фабрики', () => {
    expect(FACTORY_TEASER.href).toBe('/cases/bot-factory');
  });
});

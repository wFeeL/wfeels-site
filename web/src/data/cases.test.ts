import { describe, it, expect } from 'vitest';
import { CASES, homeCases, CASES_CATALOG_HREF } from './cases';

describe('cases.ts — внутренняя целостность', () => {
  it('шесть кейсов всего (00-overview.md)', () => {
    expect(CASES.length).toBe(6);
  });

  it('ровно четыре кейса на главной (D-048)', () => {
    expect(homeCases().length).toBe(4);
  });

  it('четыре кейса главной в порядке брифа `04-cases-brief.md`, раздел 2.1: ' +
    'этот сайт → ИИ-консультант → Заявка-Хаб → Фабрика ботов', () => {
    expect(homeCases().map((c) => c.title)).toEqual([
      'Этот сайт', 'ИИ-консультант', 'Заявка-Хаб', 'Фабрика ботов',
    ]);
  });

  it('стороны чередуются формулой homeOrder % 2 === 0 — вторая и четвёртая зеркальны', () => {
    const mirrored = homeCases().map((c) => (c.homeOrder ?? 0) % 2 === 0);
    expect(mirrored).toEqual([false, true, false, true]);
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
  });

  it('«Фабрика ботов» — описание дословно из брифа 04, раздел 6.4, а «ядро»/«единое ядро» нигде не встречаются (D-036)', () => {
    const bf = CASES.find((c) => c.slug === 'bot-factory');
    expect(bf?.description).toBe(
      'Каркас переезжает целиком — заново пишется только предметная часть. ' +
      'Четыре типа, тридцать две темы.',
    );
    expect(/\bядр[а-яё]*\b/i.test(bf?.description ?? '')).toBe(false);
    expect(bf?.description).not.toContain('единое ядро');
    expect(bf?.description).not.toContain('один движок');
  });

  it('адреса кейсов уникальны', () => {
    const slugs = CASES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('каталог кейсов ведёт на /cases', () => {
    expect(CASES_CATALOG_HREF).toBe('/cases');
  });
});

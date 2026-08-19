import { describe, it, expect } from 'vitest';
import { CASES, homeCases, CASES_CATALOG_HREF } from './cases';

describe('cases.ts — внутренняя целостность', () => {
  it('пять кейсов всего — «Фабрика ботов» снята правкой владельца 2026-08-19', () => {
    expect(CASES.length).toBe(5);
  });

  it('ровно три кейса на главной', () => {
    expect(homeCases().length).toBe(3);
  });

  it('три кейса главной в порядке брифа `04-cases-brief.md`, раздел 2.1: ' +
    'этот сайт → ИИ-консультант → Заявка-Хаб', () => {
    expect(homeCases().map((c) => c.title)).toEqual([
      'Этот сайт', 'ИИ-консультант', 'Заявка-Хаб',
    ]);
  });

  it('стороны чередуются формулой homeOrder % 2 === 0 — зеркальна только вторая', () => {
    const mirrored = homeCases().map((c) => (c.homeOrder ?? 0) % 2 === 0);
    expect(mirrored).toEqual([false, true, false]);
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

  // Сторож снятия, а не памятник: «Фабрика ботов» ушла с главной правкой
  // владельца 2026-08-19, и вернуть её молча — через данные, мимо решения —
  // нельзя. Кейса нет ни в каком виде: ни строкой на главной, ни записью
  // вне главной (в отличие от SlotBook и Storefront, которые записями
  // остаются и ждут спеку 04).
  it('«Фабрика ботов» снята из данных целиком (правка владельца 2026-08-19)', () => {
    expect(CASES.find((c) => c.slug === 'bot-factory')).toBeUndefined();
    expect(CASES.map((c) => c.title)).not.toContain('Фабрика ботов');
  });

  // D-036: слово «ядро» ушло с сайта целиком — сторож остаётся и после
  // снятия кейса, теперь на всех описаниях сразу, а не на одном.
  it('слова «ядро», «единое ядро», «один движок» не встречаются в описаниях (D-036)', () => {
    for (const c of CASES) {
      if (!c.description) continue;
      expect(/\bядр[а-яё]*\b/i.test(c.description), `«${c.title}»`).toBe(false);
      expect(c.description, c.title).not.toContain('единое ядро');
      expect(c.description, c.title).not.toContain('один движок');
    }
  });

  it('адреса кейсов уникальны', () => {
    const slugs = CASES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('каталог кейсов ведёт на /cases', () => {
    expect(CASES_CATALOG_HREF).toBe('/cases');
  });
});

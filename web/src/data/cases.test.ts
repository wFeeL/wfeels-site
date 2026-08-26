import { describe, it, expect } from 'vitest';
import { CASES, CASES_CATALOG_HREF, caseHref, homeCases, publishedCases, isPublishable } from './cases';

describe('cases.ts — внутренняя целостность', () => {
  it('пять кейсов всего — два недостроенных сняты правками владельца ' +
    '2026-08-19 и 2026-08-26', () => {
    expect(CASES.length).toBe(5);
  });

  it('три кейса на главной — «Этот сайт», Telegram Mini App и сайты', () => {
    expect(homeCases().length).toBe(3);
  });

  it('на главной остался «Этот сайт», а «ИИ-консультант» и «Заявка-Хаб» ушли с неё, ' +
    'оставшись записями с описанием для будущей страницы каталога', () => {
    expect(homeCases().map((c) => c.title)).toEqual([
      'Этот сайт', 'Telegram Mini App', 'Сайты',
    ]);
    for (const slug of ['ai-consultant', 'zayavka-hub']) {
      const c = CASES.find((x) => x.slug === slug);
      expect(c, slug).toBeDefined();
      expect(c!.onHome, slug).toBe(false);
      expect(c!.homeOrder, `${slug}: порядок на главной у снятого кейса не хранится`)
        .toBeUndefined();
      expect(c!.description, slug).toBeTruthy();
    }
  });

  it('только второй кейс зеркальный; у сайтов текст слева, скриншоты справа', () => {
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
  // вне главной (в отличие от «ИИ-консультанта» и «Заявки-Хаба», которые
  // остаются записями с `onHome: false`).
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

  it('публичная выборка публикует все и только пять записей с описанием и стеком', () => {
    expect(publishedCases().map((item) => item.slug)).toEqual([
      'site-v3', 'storefront', 'websites', 'ai-consultant', 'zayavka-hub',
    ]);
    expect(publishedCases().every((item) => item.description && item.stack)).toBe(true);
  });

  it('адреса каталога и detail-страниц строятся одним модулем', () => {
    expect(CASES_CATALOG_HREF).toBe('/cases');
    expect(publishedCases().map((item) => caseHref(item.slug))).toEqual([
      '/cases/site-v3',
      '/cases/storefront',
      '/cases/websites',
      '/cases/ai-consultant',
      '/cases/zayavka-hub',
    ]);
  });
});

/* Отрицательная ветка границы публикации — та, ради которой граница и
   заведена. До правки 2026-08-26 её проверял единственный живой пример:
   недостроенная запись SlotBook. Владелец снял её тем же днём, и в боевых
   данных неполных записей не осталось вовсе — предохранитель уцелел в коде,
   но потерял всякое доказательство. Синтетическая запись возвращает его под
   проверку, ничего не подмешивая в CASES. */
describe('граница публикации: неполная запись не выпускается', () => {
  const full = { slug: 'x', title: 'X', description: 'есть', stack: 'есть', onHome: false };

  it('запись с описанием и стеком проходит', () => {
    expect(isPublishable(full)).toBe(true);
  });

  it('без описания — не проходит', () => {
    expect(isPublishable({ ...full, description: undefined })).toBe(false);
  });

  it('без стека — не проходит', () => {
    expect(isPublishable({ ...full, stack: undefined })).toBe(false);
  });

  it('пустая строка считается отсутствием, а не текстом', () => {
    expect(isPublishable({ ...full, description: '' })).toBe(false);
    expect(isPublishable({ ...full, stack: '' })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { SERVICE_PAGES, PRICE_NOTE, servicePage, type ServicePage } from './servicePages';
import { SERVICE_GROUPS } from './services';
import { LINE_PATHS } from '../lib/linePaths';

/* Сторожа целостности `servicePages.ts` — спека
 * `70-workshop/specs/site-v3/08-service-pages.md`, раздел 7.4. Внутренняя
 * целостность (девять записей, ступени, пустые секции) уже проверена
 * `throw` на уровне модуля самого `servicePages.ts` (раздел 7.3) — этот
 * файл проверяет то, что модульным `throw` неудобно: петлю с
 * `data/services.ts`, пересечение с реестром линии, буквы «ё» и знак «₽» в
 * тексте записей. */

describe('servicePages.ts — петля с главной замкнута', () => {
  const byCode = new Map(SERVICE_PAGES.map((p) => [p.code, p]));

  for (const group of SERVICE_GROUPS) {
    for (const link of group.links) {
      it(`${link.code} («${link.text}») — есть запись SERVICE_PAGES с тем же адресом`, () => {
        const page = byCode.get(link.code);
        expect(page, `SERVICE_GROUPS несёт код «${link.code}», а SERVICE_PAGES — нет`).toBeTruthy();
        expect(`/services/${page!.slug}`, `slug «${page!.slug}» не даёт адрес «${link.href}»`)
          .toBe(link.href);
      });
    }
  }

  it('в SERVICE_PAGES нет записи без соответствующей ссылки в SERVICE_GROUPS', () => {
    const linkedCodes = new Set(
      SERVICE_GROUPS.flatMap((g) => g.links.map((l) => l.code)),
    );
    for (const page of SERVICE_PAGES) {
      expect(linkedCodes.has(page.code), `«${page.code}» есть в SERVICE_PAGES, но не в SERVICE_GROUPS`)
        .toBe(true);
    }
  });
});

describe('servicePages.ts — id секций посадочных не пересекается с реестром линии', () => {
  // Полный список `id`, которые несут секции скелета услуги (спека 08,
  // раздел 11.1). Первый экран и хлебные крошки `id` не получают вовсе.
  const SERVICE_SECTION_IDS = [
    's-vhodit', 's-granicy', 's-stupeni', 's-rabota',
    's-dokazatelstvo', 's-garantii', 's-voprosy', 's-zayavka',
  ];

  it('все id несут префикс «s-»', () => {
    for (const id of SERVICE_SECTION_IDS) {
      expect(id.startsWith('s-'), `«${id}» без префикса «s-»`).toBe(true);
    }
  });

  for (const id of SERVICE_SECTION_IDS) {
    it(`«${id}» отсутствует в LINE_PATHS`, () => {
      expect(
        Object.prototype.hasOwnProperty.call(LINE_PATHS, id),
        `«${id}» есть в LINE_PATHS — Section.astro пририсует ей кусок линии главной`,
      ).toBe(false);
    });
  }
});

/** Текст записи, собранный из ВСЕХ отображаемых полей — то, что реально
 *  может попасть на страницу. `source`/`termSource`/`timeframeSource` сюда
 *  намеренно не входят: это цитаты SERVICES.md/PRICING.md для сверки
 *  человеком, они никогда не рендерятся (см. комментарий в начале
 *  `servicePages.ts`) и по тому же правилу, что уже действует для `source`
 *  в `data/pricing.ts` (D-058, `50-code/CLAUDE.md`), вправе нести «ё» и
 *  денежные величины как в источнике. */
function displayText(page: ServicePage): string {
  return [
    page.h1, page.title, page.description, page.catalogLine, page.lead,
    page.audience, page.term, page.includesNote ?? '',
    page.proof.title, page.proof.text, page.proof.stack ?? '',
    ...page.includes.map((i) => i.text),
    ...page.excludes.map((i) => i.text),
    ...page.faq.flatMap((f) => [f.question, f.answer]),
  ].join('\n');
}

describe('servicePages.ts — без буквы «ё» в отображаемом тексте', () => {
  for (const page of SERVICE_PAGES) {
    it(`«${page.code}» — ни одной «ё»`, () => {
      const hits = [...displayText(page).matchAll(/[ёЁ]/g)];
      expect(hits.length, `найдено ${hits.length} вхождений «ё» у «${page.code}»`).toBe(0);
    });
  }
});

describe('servicePages.ts — без цифр рубля в отображаемом тексте', () => {
  for (const page of SERVICE_PAGES) {
    it(`«${page.code}» — ни одного «₽»`, () => {
      expect(displayText(page).includes('₽'), `у «${page.code}» «₽» встречается в тексте записи`)
        .toBe(false);
    });
  }
});

describe('servicePages.ts — PRICE_NOTE', () => {
  // PRICE_NOTE — общая строка раздела 4.5 брифа, не поле отдельной записи
  // (см. `displayText` выше). Она легально несёт `₽` В ЗНАЧЕНИИ ВО ВРЕМЯ
  // ВЫПОЛНЕНИЯ через подстановку `MILESTONE_THRESHOLD` («70 000 ₽»,
  // `data/process.ts`) — критерий 11 брифа проверяет ТЕКСТ ИСХОДНИКА
  // `servicePages.ts` (там подстановки нет, только `${MILESTONE_THRESHOLD}`),
  // а не готовое значение строки. Букву «ё» при этом PRICE_NOTE не несёт.
  it('без буквы «ё»', () => {
    expect(/[ёЁ]/.test(PRICE_NOTE)).toBe(false);
  });

  it('несёт порог MILESTONE_THRESHOLD, а не отдельное число', () => {
    expect(PRICE_NOTE).toContain('по вехам');
  });
});

describe('servicePages.ts — servicePage()', () => {
  it('кидает на неизвестном slug, а не возвращает undefined', () => {
    expect(() => servicePage('несуществующая-услуга')).toThrow();
  });

  it('находит запись по её собственному slug', () => {
    for (const page of SERVICE_PAGES) {
      expect(servicePage(page.slug)).toBe(page);
    }
  });
});

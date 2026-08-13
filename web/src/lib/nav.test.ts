import { describe, it, expect } from 'vitest';
import {
  HEADER_CTA_HREF, headerCtaHref, normalizePath, samePath, sections, showHeaderCta,
} from './nav';
import { hasTranslation, LOCALES } from '../i18n/locales';
import { hasHomeSection } from './sections';

describe('normalizePath', () => {
  it('снимает хвостовой слэш', () => expect(normalizePath('/contact/')).toBe('/contact'));
  it('корень остаётся корнем', () => expect(normalizePath('/')).toBe('/'));
  it('снимает якорь и запрос', () => {
    expect(normalizePath('/en/#services')).toBe('/en');
    expect(normalizePath('/cases?from=nav')).toBe('/cases');
  });
});

describe('samePath', () => {
  it('совпадение пути отмечается', () =>
    expect(samePath('/contact', '/contact')).toBe(true));
  it('хвостовой слэш совпадению не мешает', () =>
    expect(samePath('/contact', '/contact/')).toBe(true));
  it('другая страница не отмечается', () =>
    expect(samePath('/services', '/contact')).toBe(false));

  // Ссылка на секцию той же страницы — не «текущая страница»: иначе на любой
  // странице все пункты навигации разом получили бы aria-current, и
  // отметка перестала бы что-либо значить. С этой задачи так устроены ВСЕ
  // пункты шапки — не только английские — и текущий раздел показывает только
  // рельс (задача 4). НЕ «чинить» это: подробное обоснование — рядом с самой
  // функцией в `nav.ts`.
  it('ссылка на секцию не отмечается никогда', () => {
    expect(samePath('/en/#services', '/en')).toBe(false);
    expect(samePath('/en/#services', '/en/')).toBe(false);
    expect(samePath('/#services', '/')).toBe(false);
    expect(samePath('#contact', '/')).toBe(false);
  });
});

/* Разделы читают двое — шапка и подвал. Совпадение того, что они показывают,
   проверяет e2e (`tests/e2e/footer.spec.ts`): здесь проверяются свойства самого
   списка, которые ни один из двух потребителей проверить не может.

   С этой задачи пункты — якоря секций главной (`/#services` и подобные), а не
   адреса отдельных страниц: `/pricing`, `/about` и подобные не существуют.
   Раньше тест утверждал обратное — «пути абсолютные и БЕЗ якоря» — это было
   верно для старого устройства шапки и перестало быть требованием, которое
   стоит защищать: у решения «пункты — якоря» (спека 02, раздел 3) ровно
   противоположная форма. Новый инвариант — якорь ведёт на главную и указывает
   на секцию, которая там реально есть; проверяется через `lib/sections.ts`,
   единственный источник этого списка, а не второй ручной перечень тех же
   строк, который однажды расходится с первым. */
describe('sections', () => {
  it('каждый пункт — путь к главной с якорем на реальную секцию', () => {
    for (const lang of LOCALES) {
      for (const item of sections(lang)) {
        const m = item.href.match(/^\/#([a-z-]+)$/);
        expect(m, `${item.href} — не путь вида /#якорь`).not.toBeNull();
        const id = m![1];
        expect(hasHomeSection(id), `${item.href} — такой секции нет в lib/sections.ts`)
          .toBe(true);
      }
    }
  });

  it('один и тот же раздел не встречается дважды', () => {
    for (const lang of LOCALES) {
      const hrefs = sections(lang).map((i) => i.href);
      expect(new Set(hrefs).size, `повтор в разделах ${lang}`).toBe(hrefs.length);
    }
  });

  it('в русской навигации ровно пять пунктов, «Контакты» среди них нет', () => {
    const ru = sections('ru');
    expect(ru.length).toBe(5);
    expect(ru.some((i) => i.text === 'Контакты'), 'пункт «Контакты» вернулся')
      .toBe(false);
    // Порядок — под порядок страницы (правка владельца 2026-08-13): цены
    // идут четвёртой секцией, кейсы пятой, гарантии восьмой — раньше шапка
    // называла «Кейсы» перед «Цены» и спорила со страницей.
    expect(ru.map((i) => i.text))
      .toEqual(['Услуги', 'Цены', 'Кейсы', 'Гарантии', 'Обо мне']);
  });

  // Правило, которое переживёт эту задачу: английский раздел появляется в
  // навигации только вместе со своей английской страницей. Сегодня список пуст
  // и тест проходит впустую — красным он станет в тот день, когда пункт добавят
  // раньше страницы, то есть ровно тогда, когда он нужен.
  it('английский раздел обязан иметь английскую страницу', () => {
    for (const item of sections('en')) {
      expect(hasTranslation(item.href), `${item.href} — английской страницы нет`)
        .toBe(true);
    }
  });
});

describe('showHeaderCta', () => {
  // Правило живёт в одном месте, а не в свойстве каждой страницы: новая
  // страница ничего не обязана про кнопку помнить.
  it('на обычной странице кнопка есть', () => {
    expect(showHeaderCta('/')).toBe(true);
    expect(showHeaderCta('/privacy')).toBe(true);
  });
  it('на странице, куда ведёт сама кнопка, её нет', () => {
    expect(showHeaderCta(HEADER_CTA_HREF)).toBe(false);
    expect(showHeaderCta('/contact/')).toBe(false);
  });
  it('после отправки заявки её нет', () =>
    expect(showHeaderCta('/thanks')).toBe(false));
  it('английская версия тех же страниц считается так же', () => {
    expect(showHeaderCta('/en/contact')).toBe(false);
    expect(showHeaderCta('/en')).toBe(true);
  });
});

describe('headerCtaHref', () => {
  it('на главной — якорь этой же страницы, без перехода', () => {
    expect(headerCtaHref('/')).toBe('#contact');
    expect(headerCtaHref('/')).not.toBe(HEADER_CTA_HREF);
  });
  it('хвостовой слэш главной не мешает', () => {
    expect(headerCtaHref('')).toBe('#contact');
  });
  it('на любой другой странице — адрес страницы контактов', () => {
    expect(headerCtaHref('/privacy')).toBe(HEADER_CTA_HREF);
    expect(headerCtaHref('/cases')).toBe(HEADER_CTA_HREF);
  });
  // На `/en` одиннадцати секций ещё нет (спека 02 кладёт их только на
  // русскую версию) — якорь `#contact` вёл бы в пустоту. Кнопка на английской
  // главной по-прежнему ведёт на страницу контактов, как до этой задачи.
  it('на английской главной секций ещё нет — ведёт на страницу, не на якорь', () => {
    expect(headerCtaHref('/en')).toBe(HEADER_CTA_HREF);
  });
});

import { describe, it, expect } from 'vitest';
import { HEADER_CTA_HREF, normalizePath, samePath, showHeaderCta } from './nav';

describe('normalizePath', () => {
  it('снимает хвостовой слэш', () => expect(normalizePath('/kontakt/')).toBe('/kontakt'));
  it('корень остаётся корнем', () => expect(normalizePath('/')).toBe('/'));
  it('снимает якорь и запрос', () => {
    expect(normalizePath('/en/#services')).toBe('/en');
    expect(normalizePath('/keysy?from=nav')).toBe('/keysy');
  });
});

describe('samePath', () => {
  it('совпадение пути отмечается', () =>
    expect(samePath('/kontakt', '/kontakt')).toBe(true));
  it('хвостовой слэш совпадению не мешает', () =>
    expect(samePath('/kontakt', '/kontakt/')).toBe(true));
  it('другая страница не отмечается', () =>
    expect(samePath('/uslugi', '/kontakt')).toBe(false));

  // Ссылка на секцию той же страницы — не «текущая страница»: иначе на /en все
  // пять пунктов навигации разом получили бы aria-current, и отметка перестала
  // бы что-либо значить.
  it('ссылка на секцию не отмечается никогда', () => {
    expect(samePath('/en/#services', '/en')).toBe(false);
    expect(samePath('/en/#services', '/en/')).toBe(false);
  });
});

describe('showHeaderCta', () => {
  // Правило живёт в одном месте, а не в свойстве каждой страницы: новая
  // страница ничего не обязана про кнопку помнить.
  it('на обычной странице кнопка есть', () => {
    expect(showHeaderCta('/')).toBe(true);
    expect(showHeaderCta('/politika')).toBe(true);
  });
  it('на странице, куда ведёт сама кнопка, её нет', () => {
    expect(showHeaderCta(HEADER_CTA_HREF)).toBe(false);
    expect(showHeaderCta('/kontakt/')).toBe(false);
  });
  it('после отправки заявки её нет', () =>
    expect(showHeaderCta('/spasibo')).toBe(false));
  it('английская версия тех же страниц считается так же', () => {
    expect(showHeaderCta('/en/kontakt')).toBe(false);
    expect(showHeaderCta('/en')).toBe(true);
  });
});

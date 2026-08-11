import { describe, it, expect } from 'vitest';
import {
  HEADER_CTA_HREF, normalizePath, samePath, sections, showHeaderCta,
} from './nav';
import { hasTranslation, LOCALES } from '../i18n/locales';

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

  // Ссылка на секцию той же страницы — не «текущая страница»: иначе на /en все
  // пять пунктов навигации разом получили бы aria-current, и отметка перестала
  // бы что-либо значить.
  it('ссылка на секцию не отмечается никогда', () => {
    expect(samePath('/en/#services', '/en')).toBe(false);
    expect(samePath('/en/#services', '/en/')).toBe(false);
  });
});

/* Разделы читают двое — шапка и подвал. Совпадение того, что они показывают,
   проверяет e2e (`tests/e2e/footer.spec.ts`): здесь проверяются свойства самого
   списка, которые ни один из двух потребителей проверить не может. */
describe('sections', () => {
  it('пути абсолютные и без якоря', () => {
    for (const lang of LOCALES) {
      for (const item of sections(lang)) {
        expect(item.href.startsWith('/'), `${item.href} — не абсолютный путь`)
          .toBe(true);
        // Отметку текущей страницы и шапка, и подвал ставят по пути, а ссылку с
        // якорем `samePath` не отмечает никогда: пункт-якорь тихо потерял бы
        // отметку в обоих местах разом.
        expect(item.href.includes('#'), `${item.href} — якорь, а не страница`)
          .toBe(false);
      }
    }
  });

  it('один и тот же раздел не встречается дважды', () => {
    for (const lang of LOCALES) {
      const paths = sections(lang).map((i) => normalizePath(i.href));
      expect(new Set(paths).size, `повтор в разделах ${lang}`).toBe(paths.length);
    }
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

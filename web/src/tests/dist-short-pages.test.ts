import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sections } from '../lib/nav';

/* Сторож варианта A «Указатель» (`70-workshop/specs/site-v3/
 * 13-short-pages-brief.md`, раздел 4, D-129) — проверяет, что собранная
 * разметка `/404`, `/en/404`, `/thanks`, `/en/thanks` действительно несёт
 * список разделов из ЕДИНСТВЕННОГО источника (`lib/nav.ts`, `sections()`),
 * а не второй перечень подписей/адресов (критерий приёмки 12), что вторая
 * кнопка «Написать»/«Get in touch» на `/404` действительно снята (раздел
 * 2.2 брифа), и что запасной канал `/thanks` остался словесно нетронутым
 * после переезда в правую колонку (раздел 4.2 брифа: «ни одного слова не
 * меняя»). */

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));

function read(rel: string): string {
  const path = DIST + rel;
  if (!existsSync(path)) throw new Error(`нет ${rel} — сначала npm run build`);
  return readFileSync(path, 'utf8');
}

describe('короткие страницы — список разделов из единственного источника', () => {
  const pages: Array<{ file: string; lang: 'ru' | 'en' }> = [
    { file: '404.html', lang: 'ru' },
    { file: 'en/404/index.html', lang: 'en' },
    { file: 'thanks/index.html', lang: 'ru' },
    { file: 'en/thanks/index.html', lang: 'en' },
  ];

  for (const { file, lang } of pages) {
    it(`dist/${file} — ровно один <nav class="short-sections">, пункты — sections('${lang}')`, () => {
      const html = read(file);
      const navMatches = html.match(/<nav class="short-sections"/g) ?? [];
      expect(navMatches.length, `${file}: ожидалась ровно одна .short-sections`).toBe(1);

      const items = sections(lang);
      expect(items.length, `${file}: sections('${lang}') не должен опустеть`)
        .toBeGreaterThan(0);

      for (const item of items) {
        expect(html.includes(`href="${item.href}"`),
          `${file}: не найдена ссылка на раздел ${item.href}`).toBe(true);
        expect(html.includes(item.text),
          `${file}: не найдена подпись раздела «${item.text}»`).toBe(true);
      }

      // Ровно столько строк списка, сколько пунктов у sections() — не
      // больше (второй перечень) и не меньше (пункт потерялся). `<li>` несёт
      // атрибут скоупинга стилей Astro (`data-astro-cid-*`) сразу после
      // тега — регэксп не привязывается к «`<li>` без атрибутов», иначе он
      // не находит ни одной настоящей строки списка (ловушка 27
      // `50-code/CLAUDE.md`: регэксп ловит не то, что производит код).
      const li = html.match(/<li[^>]*><a href="[^"]*"[^>]*class="t-body"/g) ?? [];
      expect(li.length, `${file}: число строк списка разошлось с sections('${lang}').length`)
        .toBe(items.length);
    });
  }

  // Проверка идёт по ВИДИМОМУ ТЕКСТУ кнопки (`>Написать<`), а не по голой
  // подстроке: «Написать» входит и в `aria-label="Написать в Telegram"` /
  // «Написать на почту» шапки и подвала — эти узлы правкой не тронуты и
  // остаются на странице законно (ловушка 27, тот же род: совпадение имени
  // с чужим местом).
  it('dist/404.html — вторая кнопка тела снята (раздел 2.2 брифа)', () => {
    const html = read('404.html');
    expect(html.includes('>Написать<'), '/404: кнопка «Написать» должна быть снята').toBe(false);
  });

  it('dist/en/404/index.html — вторая кнопка тела снята', () => {
    const html = read('en/404/index.html');
    expect(html.includes('>Get in touch<'), '/en/404: кнопка «Get in touch» должна быть снята')
      .toBe(false);
  });

  it('dist/thanks/index.html — запасной канал переехал в правую колонку, слово в слово', () => {
    const html = read('thanks/index.html');
    expect(html).toContain('Если за сутки ответа не будет — напишите напрямую:');
    expect(html).toContain('https://t.me/wfeels');
    // Ровно одна `.fallback` — переезд, а не копия.
    const fallback = html.match(/class="fallback"/g) ?? [];
    expect(fallback.length, '/thanks: ожидалась ровно одна .fallback').toBe(1);
  });

  it('dist/en/thanks/index.html — запасной канал переехал в правую колонку, слово в слово', () => {
    const html = read('en/thanks/index.html');
    expect(html).toContain("If you haven't heard back within a day, write to me directly:");
    const fallback = html.match(/class="fallback"/g) ?? [];
    expect(fallback.length, '/en/thanks: ожидалась ровно одна .fallback').toBe(1);
  });
});

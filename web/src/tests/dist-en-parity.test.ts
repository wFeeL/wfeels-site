import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/* Английская главная — ТА ЖЕ страница другими словами.
 *
 * Это не пожелание, а условие приёмки перевода, поставленное владельцем
 * 2026-08-22: «весь контент на странице остаётся на местах, но уже переведён
 * на английский язык». Проверить его глазами нельзя — на странице десять
 * секций, четыре карточки услуг, девять карточек цен, пять шагов, четыре
 * гарантии, пять вопросов и форма из пяти полей, и потерянный при переводе
 * пункт заметен только тому, кто держит обе версии рядом.
 *
 * Сторож сравнивает СТРУКТУРУ собранных страниц, а не текст: последовательность
 * тегов с их `id` и классами. Совпадение этой последовательности и означает
 * «всё на местах»: пропавшая карточка, лишний пункт, переехавшая секция и
 * подменённый якорь меняют её, а любой перевод слов — нет.
 *
 * Сторожа парности данных стоят раньше и падают на сборке (`assertParallel`,
 * `i18n/locales.ts`). Этот — последний рубеж: он видит собранную страницу и
 * ловит то, чего не видит ни один из них, — расхождение в самой РАЗМЕТКЕ,
 * например условие `{locale === 'ru' && …}`, случайно оставленное в
 * компоненте.
 */

const DIST = resolve(process.cwd(), 'dist');
const ru = readFileSync(resolve(DIST, 'index.html'), 'utf8');
const en = readFileSync(resolve(DIST, 'en/index.html'), 'utf8');

/** Тег с его `id` и классами — без текста, без остальных атрибутов.
 *
 *  Атрибуты сознательно почти все отброшены: `hreflang`, `lang`, `title`,
 *  `href` у переключателя языка и `data-astro-cid-*` у стилей ОБЯЗАНЫ
 *  различаться между версиями, и требовать их совпадения значило бы сторожить
 *  не то. `id` и `class` оставлены потому, что именно они держат раскладку и
 *  якоря — то, что владелец называет «на местах». */
function skeleton(html: string): string[] {
  /* Ф-4 размечает слова закрывающей фразы через <i>. Число слов в переводе
     закономерно отличается, поэтому для проверки общей структуры эти
     служебные обёртки снимаются в обеих версиях. Саму их корректность
     проверяет отдельный dist-ink-words.test.ts. */
  const structuralHtml = html.replace(
    /(<p\b[^>]*class="[^"]*\bink\b[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/g,
    (_match, start: string, inner: string, end: string) =>
      start + inner.replace(/<\/?i>/g, '') + end,
  );
  const out: string[] = [];
  for (const m of structuralHtml.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
    const tag = m[1].toLowerCase();
    if (tag === 'br' || tag === 'wbr') continue;
    const attrs = m[2];
    const id = /\bid\s*=\s*"([^"]*)"/.exec(attrs)?.[1];
    const cls = /\bclass\s*=\s*"([^"]*)"/.exec(attrs)?.[1];
    // Классы Astro-скоупа (`astro-xxxxxxx`) выкидываются: хеш считается от
    // пути компонента и совпадает, но полагаться на это незачем.
    const classes = cls
      ? cls.split(/\s+/).filter((c) => c && !/^astro-[a-z0-9]+$/i.test(c)).sort().join('.')
      : '';
    out.push(`${tag}${id ? `#${id}` : ''}${classes ? `.${classes}` : ''}`);
  }
  return out;
}

describe('английская главная — та же страница другими словами', () => {
  const a = skeleton(ru);
  const b = skeleton(en);

  it('обе версии вообще собрались и непусты', () => {
    expect(a.length, 'русская главная пуста').toBeGreaterThan(400);
    expect(b.length, 'английская главная пуста').toBeGreaterThan(400);
  });

  it('последовательность элементов совпадает элемент в элемент', () => {
    // Отчёт называет ПЕРВОЕ расхождение и его окрестность: список длиной в
    // тысячу строк сам по себе ничего не объясняет.
    const n = Math.min(a.length, b.length);
    let at = -1;
    for (let i = 0; i < n; i += 1) {
      if (a[i] !== b[i]) { at = i; break; }
    }
    if (at === -1 && a.length !== b.length) at = n;
    const context = at === -1 ? '' :
      `\n  расхождение на элементе ${at}\n` +
      `  ru: ${a.slice(Math.max(0, at - 3), at + 3).join(' ')}\n` +
      `  en: ${b.slice(Math.max(0, at - 3), at + 3).join(' ')}`;
    expect(at, `структура версий разошлась${context}`).toBe(-1);
  });

  it('десять секций с теми же якорями и в том же порядке', () => {
    const ids = (html: string) =>
      [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids(en)).toEqual(ids(ru));
    expect(ids(ru).length).toBe(10);
  });
});

describe('английская главная — по-английски', () => {
  /** Разметка без комментариев: русская проза комментариев — документация
   *  проекта, а не текст сайта (та же граница, что в `dist-no-yo.test.ts`). */
  function withoutComments(html: string): string {
    return html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
  }

  it('кириллицы на странице нет — кроме подписи переключателя языка', () => {
    const html = withoutComments(en);
    /* Подпись переключателя на английской странице обязана быть русской: он
       называет, КУДА ведёт, и русский `title` читается тем, кто на русский и
       переключается. Строка снимается целиком — вместе с тегом. */
    const withoutSwitch = html.replace(/<a class="lang"[^>]*>[\s\S]*?<\/a>/g, '');
    const cyrillic = [...withoutSwitch.matchAll(/[^\n]*[А-Яа-яЁё][^\n]*/g)]
      .map((m) => m[0].trim());
    expect(cyrillic, `русский текст на английской странице:\n${cyrillic.join('\n')}`)
      .toEqual([]);
  });

  it('атрибут языка объявлен английским', () => {
    expect(en).toContain('<html lang="en"');
    expect(ru).toContain('<html lang="ru"');
  });

  it('обе версии объявляют друг друга в hreflang', () => {
    for (const [name, html] of [['ru', ru], ['en', en]] as const) {
      expect(html, `${name}: нет альтернативы на русскую`)
        .toMatch(/<link rel="alternate" hreflang="ru"/);
      expect(html, `${name}: нет альтернативы на английскую`)
        .toMatch(/<link rel="alternate" hreflang="en"/);
      expect(html, `${name}: нет x-default`)
        .toMatch(/<link rel="alternate" hreflang="x-default"/);
    }
  });
});

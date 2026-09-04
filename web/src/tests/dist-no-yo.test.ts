import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

/* Решение владельца 2026-08-19: на сайте вместо буквы «ё» пишется «е».
 *
 * Сторож стоит на СОБРАННОЙ разметке, а не на исходниках, и это принципиально.
 * Текст страницы приходит из четырёх разных мест — `data/*.ts`, разметка
 * `.astro`, словарь `i18n/ru.ts`, атрибуты (`alt`, `aria-label`, `title`,
 * `<meta>`, микроразметка) — и грепом по исходникам легко пропустить и то, что
 * живёт в неожиданном месте, и наоборот зацепить то, что на страницу не
 * попадает. В `dist/**\/*.html` попадает ровно то, что видит читатель.
 *
 * Из проверки вычитаются комментарии, дошедшие до собранной разметки:
 * HTML-комментарии `<!-- … -->` и строки-комментарии внутри встроенных
 * `<script>`. Решение владельца касается ТЕКСТА САЙТА; русская проза
 * комментариев — документация проекта, её правило не трогает (та же граница
 * записана в задании на замену). Сегодня таких комментариев в сборке пять
 * мест: пояснение темы в `Base.astro`, две записки в `LeadForm.astro` и
 * микроразметка страницы контактов.
 *
 * Вычитание сделано узко нарочно: снимается только комментарий, начинающийся
 * с начала строки. Общее правило «убрать всё после `//`» съело бы хвост любой
 * строки с `https://` внутри — и сторож молча перестал бы видеть кусок текста.
 */

const DIST = resolve(process.cwd(), 'dist');

function htmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...htmlFiles(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/** Убирает из разметки комментарии — и HTML, и построчные/блочные внутри
 *  встроенных `<script>`. Возвращает текст той же длины по смыслу, но без
 *  комментариев: искать «ё» дальше можно уже во всём остатке. */
export function stripComments(html: string): string {
  let s = html.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (whole, body: string) => {
    const cleaned = body
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, '');
    return whole.replace(body, cleaned);
  });
  // D-149: реальный отзыв публикуется дословно, поэтому сохраняет авторские
  // «Всё»/«всё». Общее правило сайта «ё → е» не вправе редактировать чужую
  // цитату; вычитается только семантический `<blockquote>`, не подпись и не
  // остальной блок отзывов.
  s = s.replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi, '');
  return s;
}

describe('собранная разметка — без буквы «ё»', () => {
  const files = htmlFiles(DIST);

  it('в dist вообще есть страницы (иначе проверять нечего)', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    const short = file.slice(DIST.length + 1);
    it(`${short} — ни одной «ё»`, () => {
      const text = stripComments(readFileSync(file, 'utf8'));
      const hits: string[] = [];
      for (const m of text.matchAll(/[ёЁ]/g)) {
        hits.push(`…${text.slice(Math.max(0, m.index - 60), m.index + 60).replace(/\s+/g, ' ')}…`);
      }
      expect(hits, `найдено ${hits.length}:\n${hits.join('\n')}`).toEqual([]);
    });
  }
});

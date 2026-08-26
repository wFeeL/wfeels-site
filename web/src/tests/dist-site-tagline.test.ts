import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import ru from '../i18n/ru';
import en from '../i18n/en';

/* Рычаг С-3 (`09-footer-brief.md`, раздел 7.5): `siteTagline` ушёл из
 * подвала и переехал на `/404` — единственную страницу сайта, где эта
 * строка вообще встречается. Сторож обходит ВСЮ сборку (`dist/**\/*.html`,
 * тот же приём, что `dist-links.test.ts`), а не перечисляет страницы
 * руками — список, вписанный в тест руками, стареет молча в день, когда
 * страниц становится больше (ловушка 15 `50-code/CLAUDE.md`).
 *
 * Красный прогон, которым это доказано: с `siteTagline`, ещё выведенным
 * внутри `Footer.astro` (снятое оформление), проверка «встречается ровно на
 * одной странице» падала — строка была одновременно в `dist/404.html` и во
 * ВСЕХ 28 остальных собранных страницах (подвал общий для всего сайта).
 */

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));

function htmlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...htmlFiles(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

describe('siteTagline выведен ровно на одной странице сайта', () => {
  it('дистрибутив собран', () => {
    expect(existsSync(DIST), 'нет dist/ — сначала npm run build').toBe(true);
  });

  const cases: Array<{ locale: string; tagline: string; page: string }> = [
    { locale: 'ru', tagline: ru.siteTagline, page: '404.html' },
    { locale: 'en', tagline: en.siteTagline, page: 'en/404/index.html' },
  ];

  for (const { locale, tagline, page } of cases) {
    it(`${locale}: строка встречается только на dist/${page}`, () => {
      const files = htmlFiles(DIST);
      expect(files.length, 'сборка пуста').toBeGreaterThan(0);

      const hits = files.filter((f) => readFileSync(f, 'utf8').includes(tagline));
      const relHits = hits.map((f) => f.slice(DIST.length));

      expect(relHits, `siteTagline (${locale}) обязан жить ровно на одной странице`)
        .toEqual([page]);
    });

    it(`${locale}: ни одна другая страница подвала строку не несёт`, () => {
      const files = htmlFiles(DIST).filter((f) => !f.endsWith(page));
      const leaked = files.filter((f) => readFileSync(f, 'utf8').includes(tagline));
      expect(leaked.map((f) => f.slice(DIST.length)),
        'siteTagline просочился в подвал другой страницы').toEqual([]);
    });
  }
});

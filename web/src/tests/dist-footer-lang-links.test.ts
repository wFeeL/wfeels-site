import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/* Сторож задачи Б-2 (2026-08-26): «ни одна ссылка подвала на странице с
 * языковым префиксом не должна вести на адрес без префикса».
 *
 * Заведён по следу конкретного дефекта: `Footer.astro` брал адрес кнопки
 * полосы действия из константы `HEADER_CTA_HREF` (`lib/nav.ts`) напрямую, без
 * учёта языка страницы, — на `/en/privacy`, `/en/terms`, `/en/consent` и
 * `/en/404` кнопка «Discuss a project» вела на русский `/contact`, пока
 * рядом стоящая ссылка тела той же страницы верно вела на `/en#contact`.
 *
 * Список проверяемых страниц НЕ вписан вручную (ловушки 21 и 24,
 * `50-code/CLAUDE.md` — «страниц 29, не 24») — обходит `dist/**\/*.html`
 * целиком и берёт английские страницы по факту пути в собранном дереве, тем
 * же приёмом, что уже стоит в `dist-links.test.ts` и `dist-footer-cta.test.ts`.
 *
 * Проверяется именно содержимое `<footer>…</footer>` — не вся страница: у
 * английской страницы есть законные внутренние ссылки без префикса `/en`
 * ВНЕ подвала (например, `hreflang="ru"` на юридические документы, которые
 * не переведены и не обязаны быть переведены), и это отдельный, уже принятый
 * договор (см. `TranslationNotice.astro`), а не предмет этого сторожа. */

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

/** Путь файла в `dist/` → маршрут сайта (`en/privacy/index.html` →
 *  `/en/privacy`, `en/404/index.html` → `/en/404`, корневой `index.html` →
 *  `/`). Тот же приём, что в `lib/nav.test.ts` (`showFooterCta`, `routeOf`). */
function routeOf(file: string): string {
  const rel = file.slice(DIST.length);
  if (rel === 'index.html') return '/';
  const withoutIndex = rel.endsWith('/index.html')
    ? rel.slice(0, -'/index.html'.length)
    : rel.slice(0, -'.html'.length);
  return `/${withoutIndex}`;
}

/** Внутренние ссылки внутри `<footer>…</footer>` собранной страницы — без
 *  внешних (`http…`), без `mailto:`/`tel:`, без чистых якорей той же
 *  страницы. Именно этот набор обязан нести языковой префикс на английской
 *  странице: легальный обход (ссылка с якорем на СВОЙ же корень локали, как
 *  `/en#contact`) уже несёт префикс сам по себе — он проверяется тем же
 *  правилом, не отдельным исключением. */
function footerInternalLinks(html: string): string[] {
  const footer = html.match(/<footer[\s>][\s\S]*?<\/footer>/);
  if (!footer) return [];
  return [...footer[0].matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((h) => h.startsWith('/') && !h.startsWith('//'));
}

describe('подвал английских страниц — внутренние ссылки несут /en', () => {
  it('сборка существует (npm run build перед этим набором)', () => {
    if (!existsSync(DIST)) {
      throw new Error(
        `\nВ ${DIST} нет сборки. Сначала выполни \`npm run build\` в web/, ` +
        'затем повтори `npm run test:unit`.',
      );
    }
    expect(true).toBe(true);
  });

  if (!existsSync(DIST)) return;

  const files = htmlFiles(DIST).filter((f) => !f.endsWith('.json'));
  const enPages = files
    .map((f) => ({ path: routeOf(f), html: readFileSync(f, 'utf8') }))
    .filter(({ path }) => path === '/en' || path.startsWith('/en/'));

  it('обход dist нашёл английские страницы — сторож не ослеп', () => {
    expect(enPages.length).toBeGreaterThan(0);
  });

  for (const { path, html } of enPages) {
    const links = footerInternalLinks(html);
    it(`${path} — ${links.length} внутренних ссылок подвала, все с /en`, () => {
      for (const href of links) {
        expect(
          href === '/en' || href.startsWith('/en/') || href.startsWith('/en#'),
          `${path}: ссылка подвала «${href}» ведёт на адрес без языкового ` +
          'префикса — читатель английской страницы уходит на русскую версию',
        ).toBe(true);
      }
    });
  }
});

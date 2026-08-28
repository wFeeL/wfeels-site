import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/* Сторож правила подавления полосы действия (спека `09-footer-brief.md`,
 * раздел 3.3): «полоса выводится там, где у самой страницы своего названного
 * действия нет — и оба признака вычисляются, а не перечисляются списком
 * адресов».
 *
 * Список объектов проверки НЕ вписан вручную (ловушки 15 и 21,
 * `50-code/CLAUDE.md`) — обходит `dist/**\/*.html` целиком, тем же приёмом,
 * что уже стоит в `dist-links.test.ts` и `dist-no-yo.test.ts`. Число
 * страниц сегодня — 29, но сторож этого числа нигде не называет — он его не
 * хранит, а видит.
 *
 * Правка 2026-08-26 (раздел 3.1 брифа, «у правила появился второй
 * признак»): признак «своя форма» (`<form` внутри `<main>`) остаётся первым
 * признаком, а второй читается из уже собранной разметки, а не из имени
 * файла — `<meta name="robots">` содержит `nofollow` ровно тогда, когда
 * страница объявлена служебным конечным экраном (`Base.astro`, проп
 * `nofollow`). `/thanks` больше не узнаётся по пути: снятие полосы там
 * теперь следствие того же признака 2, что и на `/404` — прежний
 * путь-по-имени (`isThanks`) снят вместе с последним литералом маршрута в
 * этом стороже. */

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

/** Признак 2 (раздел 3.1 брифа), читанный из уже собранной страницы, а не из
 *  её имени: `<meta name="robots">` несёт `nofollow` ровно на служебных
 *  конечных экранах (`/404`, `/en/404`, `/thanks`, `/en/thanks`) — публичные
 *  правовые документы остаются `noindex, follow` и под признак не подпадают. */
function isServiceScreen(html: string): boolean {
  const match = html.match(/<meta name="robots" content="([^"]*)"/);
  return !!match && match[1].includes('nofollow');
}

/* `/dev/ui` — служебная витрина компонентов (`lib/dev-pages.ts`), существует
 * в `dist` только когда сборка запущена с `DEV_PAGES=1` (так делает
 * `webServer` в `playwright.config.ts`). Не боевая страница сайта и не входит
 * в 24/29 собранных страниц спеки — исключена поимённо, тем же приёмом, что
 * уже стоит в `e2e/font-fallback-metrics.spec.ts`. */
const isDevGallery = (path: string) => /(^|\/)dev\/ui\/index\.html$/.test(path);

describe('полоса действия подвала — правило подавления по признаку, не по списку', () => {
  const files = htmlFiles(DIST).filter((f) => !isDevGallery(f));

  it('сборка не пуста — сторож не ослеп', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = file.replace(DIST, '');
    const html = readFileSync(file, 'utf8');
    const hasForm = html.includes('<form');
    const serviceScreen = isServiceScreen(html);
    const ctaCount = (html.match(/class="footer-cta"/g) ?? []).length;

    if (hasForm || serviceScreen) {
      it(`${rel}: своя форма или служебный конечный экран (nofollow) — в подвале нет .footer-cta`, () => {
        expect(ctaCount, `${rel}: полоса действия не должна выводиться`).toBe(0);
      });
    } else {
      it(`${rel}: своего призыва нет — в подвале ровно одна .footer-cta`, () => {
        expect(ctaCount, `${rel}: ожидалась ровно одна полоса действия`).toBe(1);
      });
    }
  }
});

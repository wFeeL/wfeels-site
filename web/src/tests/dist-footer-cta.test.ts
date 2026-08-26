import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/* Сторож правила подавления полосы действия (спека `09-footer-brief.md`,
 * раздел 3.3): «полоса выводится там, где у самой страницы своего призыва
 * нет — признак: есть ли на странице собственная форма заявки».
 *
 * Список объектов проверки НЕ вписан вручную (ловушки 15 и 21,
 * `50-code/CLAUDE.md`) — обходит `dist/**\/*.html` целиком, тем же приёмом,
 * что уже стоит в `dist-links.test.ts` и `dist-no-yo.test.ts`. Число
 * страниц сегодня — 29 (не 24, как в старой редакции брифа: пять английских
 * правовых и служебных страниц влиты 2026-08-26 уже после того замера), но
 * сторож этого числа нигде не называет — он его не хранит, а видит.
 *
 * Признак «своя форма» — `<form` в собранной разметке. `/thanks` формы не
 * несёт, но полосы у неё тоже не должно быть по отдельной причине (раздел
 * 3.3: заявка только что отправлена, повторный призыв читается как «мы её
 * потеряли») — путь узнаётся по имени файла, а не по содержимому, ровно
 * настолько же законно, насколько сама причина завязана на смысл адреса, а
 * не на разметку. */

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

const isThanks = (path: string) => /(^|\/)thanks\/index\.html$/.test(path);

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
    const ctaCount = (html.match(/class="footer-cta"/g) ?? []).length;

    if (hasForm || isThanks(file)) {
      it(`${rel}: своя форма или /thanks — в подвале нет .footer-cta`, () => {
        expect(ctaCount, `${rel}: полоса действия не должна выводиться`).toBe(0);
      });
    } else {
      it(`${rel}: своего призыва нет — в подвале ровно одна .footer-cta`, () => {
        expect(ctaCount, `${rel}: ожидалась ровно одна полоса действия`).toBe(1);
      });
    }
  }
});

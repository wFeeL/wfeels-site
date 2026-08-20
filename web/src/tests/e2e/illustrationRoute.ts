import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Адрес страницы сборки, на которой сегодня выведен рисунок с этим машинным
 *  признаком, — или `null`, если такой страницы нет.
 *
 *  Заведено 2026-08-20. Правка владельца оставила на главной один кейс, и
 *  рисунки «Одна труба» (`data-case-flow`) и «Пример диалога»
 *  (`data-case-dialogue`) перестали выводиться. Их прогоны не удалены и не
 *  переписаны под пустоту: они спрашивают у СБОРКИ, где лежит их предмет, и
 *  спят ровно до тех пор, пока его негде открыть. Появится страница каталога
 *  кейсов (спека 04) — прогоны проснутся сами и пойдут на неё, без правки
 *  этого файла и без правки спеков.
 *
 *  Файл называется без `.spec`, поэтому Playwright не считает его набором
 *  тестов (`testMatch` по умолчанию — только `*.spec.ts` / `*.test.ts`).
 */

const DIST = fileURLToPath(new URL('../../../dist/', import.meta.url));

function htmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}${entry.name}`;
    if (entry.isDirectory()) out.push(...htmlFiles(`${full}/`));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

export function routeWithMarker(marker: string): string | null {
  if (!existsSync(DIST)) return null;
  for (const file of htmlFiles(DIST)) {
    if (!readFileSync(file, 'utf8').includes(marker)) continue;
    const rel = file.slice(DIST.length).replace(/index\.html$/, '').replace(/\.html$/, '');
    return `/${rel}`.replace(/(.)\/$/, '$1');
  }
  return null;
}

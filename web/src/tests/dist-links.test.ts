import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/* Сторож ссылок в никуда — на ВСЕХ собранных страницах, не только на
 * главной.
 *
 * Заведён 2026-08-20 как `dist-home-links.test.ts` по следу конкретного
 * дефекта: под секцией кейсов стояла кнопка «Все кейсы» на `/cases` —
 * страницы по этому адресу не было, кнопка вела в 404, а прогон был
 * зелёным, потому что сторож проверял НАЛИЧИЕ АДРЕСА В РАЗМЕТКЕ, а не
 * наличие страницы по этому адресу. Тот же класс ошибки — «проверка есть,
 * проверяет не то» — в этом репозитории ловили уже трижды.
 *
 * Расширен и переименован 2026-08-22 (спека `70-workshop/specs/site-v3/
 * 08-service-pages.md`, критерий 5): девять посадочных и каталог услуг
 * добавили новые внутренние ссылки — между страницами услуг, из каталога
 * на услугу, из услуги на другую услугу (`[текст](адрес)` в «Что не
 * входит», S2). Сторож на одном `index.html` этого не увидел бы: обходит
 * теперь ВСЕ `dist/**\/*.html`, и второго сторожа того же дефекта с другим
 * охватом (был отдельно на главной) больше не остаётся.
 *
 * Проверяется СБОРКА, а не список маршрутов: у каждого внутреннего `href`
 * любой страницы обязан существовать файл в `dist/`. Список маршрутов был
 * бы третьей ручной копией тех же путей и молчал бы ровно там, где молчал
 * прежний тест.
 *
 * Почему это не дубль обхода `e2e/links.spec.ts`. Обход спрашивает у
 * сервера то же, что спросит браузер, — и это сильнее. Но у него есть
 * список `NOT_BUILT_YET` с записями «оставлены про запас», и адрес может
 * пролежать в нём и после того, как ссылка на него появится, если сама
 * ссылка живёт на странице, до которой обход не доходит. Здесь этой
 * лазейки нет — см. правило «список без запаса» ниже. Плюс этот сторож не
 * требует браузера и падает уже на `npm run test:unit`.
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

/** Внутренние адреса одной страницы: без внешних, без чистых якорей, без
 *  query-хвоста, без завершающего слеша (кроме корня). */
function internalLinks(html: string): string[] {
  return [...new Set(
    [...html.matchAll(/href="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((h) => h.startsWith('/'))
      .map((h) => h.split('#')[0].split('?')[0].replace(/(.)\/$/, '$1'))
      .filter((h) => h.length > 0),
  )];
}

/** Есть ли в сборке файл, который отдаст этот адрес. Проверяются все три
 *  формы, в которых Astro кладёт вывод: каталог со своим `index.html`,
 *  одиночный `.html` и обычный файл (шрифт, стиль, иконка). */
function builtIn(path: string): boolean {
  const rel = path.replace(/^\//, '');
  if (rel === '') return existsSync(`${DIST}index.html`);
  return existsSync(`${DIST}${rel}/index.html`)
    || existsSync(`${DIST}${rel}.html`)
    || existsSync(`${DIST}${rel}`);
}

/** Адреса, которых в сборке заведомо нет, — вместе с причиной.
 *
 *  Правило списка ОДНО и оно жёсткое: **никакого запаса**. Адрес попадает
 *  сюда только тогда, когда ссылка на него уже стоит на какой-то собранной
 *  странице, и уходит отсюда в тот же день, когда ссылка снята или страница
 *  построена. Тест проверяет это в обе стороны: неизвестный битый адрес
 *  роняет прогон, и лишняя запись — тоже. Спека 08 (критерий 3) требует
 *  список пустым по итогам этого захода: все десять адресов услуг были
 *  здесь ДО прохода и обязаны уйти в тот же день, когда страницы построены. */
const KNOWN_UNBUILT: ReadonlyArray<{ path: string; why: string }> = [];

describe('dist/**/*.html — ни одной ссылки в никуда', () => {
  const files = htmlFiles(DIST);

  it('сборка существует (npm run build перед этим набором)', () => {
    if (files.length === 0) {
      throw new Error(
        `\nВ ${DIST} нет ни одного .html. Сначала выполни \`npm run build\` в ` +
        'web/, затем повтори `npm run test:unit`.',
      );
    }
    expect(files.length).toBeGreaterThan(5);
  });

  if (files.length === 0) return;

  // Карта «адрес → страницы, с которых на него ссылаются» — чтобы отчёт
  // называл место правки, а не только битый адрес.
  const linkedFrom = new Map<string, string[]>();
  for (const file of files) {
    const short = file.slice(DIST.length);
    for (const href of internalLinks(readFileSync(file, 'utf8'))) {
      linkedFrom.set(href, [...(linkedFrom.get(href) ?? []), short]);
    }
  }
  const internal = [...linkedFrom.keys()].sort();

  it('обход нашёл ссылки — пустой список зелён и бесполезен', () => {
    expect(internal.length).toBeGreaterThan(10);
    expect(internal, 'сама главная').toContain('/');
  });

  const unbuilt = new Map(KNOWN_UNBUILT.map((e) => [e.path, e.why]));

  for (const path of internal) {
    it(`${path} — страница есть в сборке`, () => {
      const from = linkedFrom.get(path)!.join(', ');
      if (unbuilt.has(path)) {
        expect(
          builtIn(path),
          `${path} УЖЕ построен — убери запись из KNOWN_UNBUILT: ` +
          `«${unbuilt.get(path)}»`,
        ).toBe(false);
        return;
      }
      expect(
        builtIn(path),
        `ссылка в никуда: ${from} ведёт на ${path}, а в dist/ нет ни ` +
        `${path}/index.html, ни ${path}.html, ни файла по этому пути. ` +
        'Либо снимите ссылку, либо постройте страницу, либо — если страница ' +
        'запланирована и решение принято — впишите адрес в KNOWN_UNBUILT ' +
        'вместе с причиной.',
      ).toBe(true);
    });
  }

  it('в KNOWN_UNBUILT нет записей «про запас»: каждая описывает живую ссылку', () => {
    for (const { path, why } of KNOWN_UNBUILT) {
      expect(
        internal,
        `KNOWN_UNBUILT несёт ${path} («${why}»), но ссылки на этот адрес нет ` +
        'ни на одной собранной странице. Список — запись о сегодняшнем ' +
        'состоянии, а не задел на будущее: убери строку.',
      ).toContain(path);
    }
  });

  it('KNOWN_UNBUILT пуст (спека 08, критерий 3)', () => {
    expect(KNOWN_UNBUILT).toEqual([]);
  });
});

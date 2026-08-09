import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, extname } from 'node:path';

const DIST = new URL('../web/dist/', import.meta.url).pathname;
const MAX_PAGE_BYTES = 400 * 1024;
const MAX_JS_GZIP_BYTES = 30 * 1024;

const PAGES = ['index.html', 'kontakt/index.html', 'politika/index.html'];

// Исполняемые типы `<script>`. Отсутствие атрибута — тоже JS.
// `application/ld+json`, `importmap`, `speculationrules` браузер как код не
// исполняет: это данные, и в предел на JS они не идут.
const JS_TYPES = new Set([
  'module',
  'text/javascript',
  'application/javascript',
  'text/ecmascript',
  'application/ecmascript',
]);

// Весь JavaScript страницы: тела инлайновых `<script>` и содержимое внешних
// файлов, на которые они ссылаются. Astro встраивает свои модульные скрипты
// прямо в разметку, поэтому обход только по `.js`-файлам `dist` не находит
// ничего и предел молча показывает ноль при любом объёме кода.
function collectPageJs(html, distDir) {
  const parts = [];

  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const [, attrs, body] = m;
    const type = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i)?.[1].toLowerCase();
    if (type !== undefined && !JS_TYPES.has(type)) continue;

    const src = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (src) {
      if (/^[a-z]+:|^\/\//i.test(src)) continue; // внешний домен — не наш вес
      try {
        parts.push(readFileSync(join(distDir, src.replace(/^\/?/, '/'))));
      } catch {
        continue;
      }
    } else if (body.trim() !== '') {
      parts.push(Buffer.from(body, 'utf8'));
    }
  }

  return parts;
}

// Сжимаем сумму, а не складываем сжатые куски: скрипты лежат в одном документе
// и делят словарь, поэтому сумма отдельных gzip завышает реальный вес.
function gzipTotal(parts) {
  return parts.length === 0 ? 0 : gzipSync(Buffer.concat(parts)).length;
}

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return []; // директории может не быть, если сборка не породила ассетов
  }
  return entries.flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const assets = walk(join(DIST, '_astro')).filter((f) =>
  ['.js', '.css'].includes(extname(f)));

let failed = false;

for (const page of PAGES) {
  const html = readFileSync(join(DIST, page));
  const refs = [...html.toString().matchAll(/\/_astro\/[^"']+/g)].map((m) => m[0]);

  let total = html.length;
  let fontBytes = 0;
  const jsGzip = gzipTotal(collectPageJs(html.toString(), DIST));

  for (const ref of new Set(refs)) {
    const file = join(DIST, ref);
    let buf;
    try {
      buf = readFileSync(file);
    } catch {
      continue;
    }
    total += buf.length;

    // Шрифты не упомянуты в HTML — на них ссылается CSS, поэтому обход только
    // по разметке их не видит. А это самая тяжёлая часть страницы: 148 КБ,
    // больше трети бюджета ещё до единой буквы контента. Гейт, который их не
    // считает, разрешает ровно тот перевес, ради которого он поставлен.
    if (extname(file) === '.css') {
      const css = buf.toString();
      const fonts = [...css.matchAll(/url\(([^)]*\/_astro\/[^)]+?)\)/g)]
        .map((m) => m[1].replace(/["']/g, ''))
        // Подмножества разделены по `unicode-range`, и браузер тянет только те,
        // чьи символы встретились на странице. Русская страница берёт кириллицу
        // и латиницу; `greek`, `cyrillic-ext` и `latin-ext` останутся нескачанными,
        // пока в тексте не появятся их символы. Считаем то, что скачается на самом
        // деле, иначе гейт завышает вес и начинает врать в другую сторону.
        .filter((u) => /cyrillic-wght|latin-wght/.test(u));

      for (const url of new Set(fonts)) {
        try {
          fontBytes += readFileSync(join(DIST, url.replace(/^\/?/, '/'))).length;
        } catch {
          continue;
        }
      }
    }
  }

  total += fontBytes;

  const kb = (n) => `${(n / 1024).toFixed(1)} КБ`;
  const pageOk = total <= MAX_PAGE_BYTES;
  const jsOk = jsGzip <= MAX_JS_GZIP_BYTES;

  console.log(
    `${pageOk && jsOk ? '✓' : '✗'} ${page} — всего ${kb(total)} (предел ${kb(MAX_PAGE_BYTES)}), ` +
    `из них шрифты ${kb(fontBytes)}, JS сжатый ${kb(jsGzip)} (предел ${kb(MAX_JS_GZIP_BYTES)})`
  );

  if (!pageOk || !jsOk) failed = true;
}

if (failed) {
  console.error(
    '\nБюджет превышен. Либо чинить вес, либо снимать с сайта утверждение ' +
    '«вес страницы против медианы» — оно перестанет быть правдой.'
  );
  process.exit(1);
}

console.log(`\nВсего ассетов в сборке: ${assets.length}`);

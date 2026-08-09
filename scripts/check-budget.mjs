import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, extname, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// `fileURLToPath`, а не `.pathname`: в пути с пробелом или кириллицей `pathname`
// остаётся процентно-закодированным (`/Users/имя%20с/dist`), и скрипт не находит
// сборку на ровном месте.
const DIST = fileURLToPath(new URL('../web/dist/', import.meta.url));
const MAX_PAGE_BYTES = 400 * 1024;
const MAX_JS_GZIP_BYTES = 30 * 1024;

const PAGES = ['index.html', 'kontakt/index.html', 'politika/index.html'];

const FONT_EXT = new Set(['.woff2', '.woff', '.ttf', '.otf', '.eot']);

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

// Атрибуты, по которым браузер СКАЧИВАЕТ файл при загрузке страницы. Список
// белый, а не чёрный: `<a href>`, `<area href>`, `<form action>`, `<base href>`
// сюда намеренно не входят — это переходы, а не вес первой загрузки, и ссылка
// на ещё не собранную страницу не должна ронять гейт.
const RESOURCE_ATTRS = {
  script: ['src'],
  img: ['src', 'srcset'],
  source: ['src', 'srcset'],
  video: ['src', 'poster'],
  audio: ['src'],
  iframe: ['src'],
  embed: ['src'],
  track: ['src'],
  input: ['src'],
  object: ['data'],
};

// Значения `rel`, при которых `<link href>` — это загрузка файла. `canonical`,
// `alternate`, `author`, `sitemap`, `preconnect`, `dns-prefetch` файла не тянут.
const FETCHING_REL = new Set([
  'stylesheet',
  'preload',
  'modulepreload',
  'prefetch',
  'icon',
  'shortcut',
  'apple-touch-icon',
  'mask-icon',
  'manifest',
]);

function fail(message) {
  console.error(`\n${message}`);
  process.exit(1);
}

function shortPath(file) {
  return `/${relative(DIST, file)}`;
}

function attrValue(attrs, name) {
  const m = attrs.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i')
  );
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

// Ссылка → путь на диске, либо `null`, если файл не наш.
// Строку запроса НЕ отбрасываем: `style.css?v=2` должен упасть с именем файла, а
// не тихо исчезнуть из веса — ровно так однажды поведёт себя новая версия Astro
// или плагин, и молчаливый пропуск превратил бы 179 КБ в 5 КБ с галочкой.
function resolveRef(ref, baseDir) {
  const clean = ref.trim().replace(/#.*$/, ''); // фрагмент — не часть файла
  if (clean === '') return null;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(clean)) return null; // внешний адрес, data:, mailto:
  return clean.startsWith('/') ? join(DIST, clean) : join(baseDir, clean);
}

function splitSrcset(value) {
  // `data:`-URI внутри `srcset` содержит запятые и ломает разбор кандидатов.
  // Такие ссылки пропускаем целиком: их байты уже лежат в разметке и посчитаны
  // в весе самого HTML.
  if (/data:/i.test(value)) return [];
  return value
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter((url) => url !== '');
}

// Все подресурсы страницы: то, что браузер скачает, кроме навигации.
function markupRefs(html) {
  const refs = [];

  for (const m of html.matchAll(/<([a-zA-Z][\w-]*)\b([^>]*)>/g)) {
    const tag = m[1].toLowerCase();
    const attrs = m[2];

    if (tag === 'link') {
      const rel = (attrValue(attrs, 'rel') ?? '').toLowerCase().split(/\s+/);
      if (!rel.some((token) => FETCHING_REL.has(token))) continue;
      const href = attrValue(attrs, 'href');
      if (href) refs.push({ ref: href, where: `<link rel="${rel.join(' ')}">` });
      continue;
    }

    for (const name of RESOURCE_ATTRS[tag] ?? []) {
      const value = attrValue(attrs, name);
      if (!value) continue;
      const urls = name === 'srcset' ? splitSrcset(value) : [value];
      for (const url of urls) refs.push({ ref: url, where: `<${tag} ${name}>` });
    }
  }

  return refs;
}

// `U+301`, `U+300-301`, `U+2D?`, `U+??` → пара кодов.
function parseUnicodeRange(token) {
  const t = token.trim().replace(/^U\+/i, '');
  if (t.includes('-')) {
    const [a, b] = t.split('-');
    return [parseInt(a, 16), parseInt(b, 16)];
  }
  if (t.includes('?')) {
    return [parseInt(t.replace(/\?/g, '0'), 16), parseInt(t.replace(/\?/g, 'F'), 16)];
  }
  const v = parseInt(t, 16);
  return [v, v];
}

// Символы, которые страница реально рисует. Тела `<script>` и `<style>` не
// рендерятся, поэтому вырезаны: иначе символ из исходника CSS потянул бы в
// расчёт подмножество, которого на экране нет.
// Известное ограничение: глифы, подставленные из CSS (`content: "→"`), отсюда
// не видны — их не покрывает ни этот разбор, ни прежний фильтр по имени файла.
function pageCodepoints(html) {
  const text = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&hellip;/g, '…');

  const codes = new Set();
  for (const ch of text) codes.add(ch.codePointAt(0));
  return codes;
}

// Подмножества шрифта разделены по `unicode-range`, и браузер тянет только те,
// чьи символы встретились на странице. Раньше нужные подмножества были заданы
// константой `cyrillic-wght|latin-wght` — она была верна ровно до первого нового
// символа: `₽` относится к `latin-ext`, и в день появления страницы цен три файла
// на 49 496 байт стали бы невидимы для гейта. Поэтому подмножества выводятся из
// символов самой страницы: список сам не устареет.
function fontFacesFromCss(css, cssFile) {
  const faces = [];
  for (const block of css.matchAll(/@font-face\s*{([^}]*)}/gi)) {
    const body = block[1];
    const urls = [...body.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)].map((m) => m[2]);
    const rangeAttr = body.match(/unicode-range\s*:\s*([^;}]+)/i)?.[1];
    const ranges = rangeAttr
      ? rangeAttr.split(',').map(parseUnicodeRange)
      : null; // без `unicode-range` начертание покрывает всё
    faces.push({ urls, ranges, cssFile });
  }
  return faces;
}

function faceIsUsed(face, codes) {
  if (face.ranges === null) return true;
  for (const [from, to] of face.ranges) {
    for (const code of codes) if (code >= from && code <= to) return true;
  }
  return false;
}

// Весь JavaScript страницы: тела инлайновых `<script>` и содержимое внешних
// файлов, на которые они ссылаются. Astro встраивает свои модульные скрипты
// прямо в разметку, поэтому обход только по `.js`-файлам `dist` не находит
// ничего и предел молча показывает ноль при любом объёме кода.
// Разбор регуляркой, а не парсером: держится он не на удаче, а на том, что
// бандлер обязан экранировать последовательность `</script>` внутри строковых
// литералов — иначе разметку оборвал бы и сам браузер.
function collectPageJs(html, page, pageDir) {
  const parts = [];

  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const [, attrs, body] = m;
    const type = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i)?.[1].toLowerCase();
    if (type !== undefined && !JS_TYPES.has(type)) continue;

    const src = attrValue(attrs, 'src');
    if (src) {
      const file = resolveRef(src, pageDir);
      if (file === null) continue; // внешний домен — не наш вес
      parts.push(readFileSync(file)); // отсутствие файла уже поймал обход ресурсов
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

if (!existsSync(DIST)) {
  fail(
    `Каталог сборки не найден: ${DIST}\n` +
    'Сначала собери сайт: `npm run build` в `web/`, потом повтори `npm run check:budget`.'
  );
}

const assets = walk(join(DIST, '_astro')).filter((f) =>
  ['.js', '.css'].includes(extname(f)));

// Диагностическая строка печатается ВСЕГДА, до проверок: она нужнее всего
// именно тогда, когда гейт падает.
console.log(`Всего ассетов в сборке: ${assets.length}\n`);

let failed = false;

for (const page of PAGES) {
  const pageFile = join(DIST, page);
  if (!existsSync(pageFile)) {
    fail(
      `Страница ${page} отсутствует в сборке (${pageFile}).\n` +
      'Либо сборка устарела — выполни `npm run build` в `web/`, либо страницу переименовали ' +
      'и список PAGES в этом скрипте нужно поправить.'
    );
  }

  const htmlBuf = readFileSync(pageFile);
  const html = htmlBuf.toString();
  const pageDir = dirname(pageFile);
  const codes = pageCodepoints(html);

  let total = htmlBuf.length;
  let fontBytes = 0;
  const counted = new Set(); // один файл — один раз, даже если на него ссылаются и разметка, и CSS

  // Очередь: разметка даёт первый слой, CSS — второй (шрифты и картинки фона).
  const queue = markupRefs(html).map((r) => ({ ...r, baseDir: pageDir }));

  while (queue.length > 0) {
    const { ref, where, baseDir } = queue.shift();
    const file = resolveRef(ref, baseDir);
    if (file === null) continue; // чужой домен — за него мы не отвечаем

    if (counted.has(file)) continue;

    let buf;
    try {
      buf = readFileSync(file);
    } catch {
      fail(
        `Страница ${page}: ссылка ${where} ведёт на файл, которого нет в сборке.\n` +
        `  ссылка: ${ref}\n` +
        `  искали: ${file}\n` +
        'Пока такой файл не найден, вес страницы посчитан неверно, и «пройдено» было бы ложью. ' +
        'Частая причина — строка запроса или хэш в ссылке, которых нет в имени файла на диске.'
      );
    }

    counted.add(file);
    total += buf.length;
    if (FONT_EXT.has(extname(file))) fontBytes += buf.length;

    if (extname(file) === '.css') {
      const css = buf.toString();
      const cssDir = dirname(file);
      const faces = fontFacesFromCss(css, file);
      const faceUrls = new Set(faces.flatMap((f) => f.urls));

      // Шрифты: только те подмножества, чьи символы есть на странице.
      for (const face of faces) {
        if (!faceIsUsed(face, codes)) continue;
        for (const url of face.urls) {
          queue.push({ ref: url, where: `@font-face в ${shortPath(file)}`, baseDir: cssDir });
        }
      }

      // Остальное, что тянет CSS: фоновые картинки, маски, курсоры.
      for (const m of css.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)) {
        const url = m[2];
        if (faceUrls.has(url)) continue; // уже разобрано как шрифт
        queue.push({ ref: url, where: `url() в ${shortPath(file)}`, baseDir: cssDir });
      }
    }
  }

  // Страница без единого шрифта на этой сборке физически невозможна: шрифты
  // подключены глобально в Base. Ноль здесь означает, что сломался разбор, а не
  // что страница похудела. Молчать об этом нельзя — гейт перестал бы считать,
  // продолжая печатать галочку.
  if (fontBytes === 0) {
    fail(
      `Страница ${page}: в вес не попало ни одного шрифта.\n` +
      'Это поломка разбора, а не лёгкая страница: шрифты подключены в Base.astro и ' +
      'скачиваются на каждой странице. Проверь разбор @font-face и unicode-range в этом скрипте.'
    );
  }

  const jsGzip = gzipTotal(collectPageJs(html, page, pageDir));

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

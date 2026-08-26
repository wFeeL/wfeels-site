import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, extname, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// `fileURLToPath`, а не `.pathname`: в пути с пробелом или кириллицей `pathname`
// остаётся процентно-закодированным (`/Users/имя%20с/dist`), и скрипт не находит
// сборку на ровном месте.
const DIST = fileURLToPath(new URL('../web/dist/', import.meta.url));
/* Предел поднят с 400 до 500 КБ решением владельца 2026-08-13: иллюстрации
   кейсов и переработка секций уперлись в 397,1 КБ, и дальше выбор стоял между
   «резать графику» и «дать запас». Выбран запас.

   Что при этом НЕ меняется и меняться не должно: страница по-прежнему вслух
   называет свой вес и кратность к медиане, и проверка ниже по-прежнему сверяет
   оба числа с фактом. Предел — это потолок расхода, а не разрешение округлять
   обещание. Побочное следствие, принятое сознательно: чем тяжелее страница,
   тем слабее её собственный аргумент — кратность к медиане падает
   (388 КБ → «в семь раз», 397 → «в шесть», ~500 → «в пять»). */
const MAX_PAGE_BYTES = 500 * 1024;
const MAX_JS_GZIP_BYTES = 30 * 1024;

/* ПРАВКА 2026-08-23 — список страниц был вписан руками (три штуки) и
   каталог сведения услуг вырос до семнадцати страниц без единого сторожа
   веса на десять новых посадочных: ровно ловушка 8 из `50-code/CLAUDE.md`
   («сторож мерит верную величину не в том месте» — здесь предмет проверки
   зависит от параметра «страница», а полоса была вписана как три точки).

   Список выводится обходом `dist/`, тем же приёмом, что уже применяет
   `web/src/tests/dist-links.test.ts` для ссылок: рекурсивный `readdirSync`,
   а не ручная копия путей, которая молчала бы про каждую новую страницу
   ровно так же, как молчала про эти десять. `_astro/` — не страница, а
   каталог собранных ассетов (JS/CSS), исключён явно, иначе обход принял бы
   хешированные бандлы за HTML-страницы (там их нет, но полагаться на это
   не стоит). */
function htmlPages(dir, base = dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    if (entry.name === '_astro') return [];
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return htmlPages(full, base);
    return entry.name.endsWith('.html') ? [relative(base, full)] : [];
  });
}

/* `dev/ui/index.html` — служебная витрина компонентов (`web/src/lib/
   dev-pages.ts`). В боевой сборке (`npm run build`, без `DEV_PAGES=1`) её
   нет вовсе, но `dist/` — общий каталог: если перед этим сторожем кто-то
   пересобрал сайт под e2e (`playwright.config.ts` ставит `DEV_PAGES=1` для
   своего `webServer`), файл остаётся на диске, и без явного исключения
   гейт напечатал бы 18 страниц вместо 17 — состав списка зависел бы от
   того, кто последним собирал сайт, а не от того, что реально публикуется.
   Исключение поимённое, тем же способом, что `WEIGHT_ILLUSTRATION_PAGES`
   выше решает похожую задачу «эта страница по устройству не такая, как
   остальные». */
const EXCLUDED_PAGES = new Set(['dev/ui/index.html']);

const PAGES = htmlPages(DIST)
  .filter((page) => !EXCLUDED_PAGES.has(page))
  .sort();

/* Иллюстрация «Замер» (`CaseWeightIllustration.astro`) стоит на обеих
   главных и, с решения D-122 (раздел 4.6 брифа страниц кейсов), на странице
   кейса `site-v3` — а завтра может встать и на любой другой странице, если
   владелец так решит. Список страниц, где искать иллюстрацию, поэтому
   выводится из разметки самой сборки (наличие маркера ниже) — редактор
   гейта здесь ничего не перечисляет руками; исключение одно и явное —
   обязательный минимум ОБЕИХ главных, где отсутствие маркера остаётся
   красным дефектом, даже если по факту искать нечего.

   Решение владельца 2026-08-14, пункт 7 списка правок ([[03-redesign-2026-
   08-14]], раздел 1 и раздел 4.1): гейт перецеплен с прозаической фразы
   «Она весит N КБ… в N раз больше» (удалена со страницы) на срез разметки
   самой иллюстрации. */
/* Иллюстрацию несут ОБЕ главные, и утверждения на них одни и те же числа,
   записанные по правилам своего языка: «410 КБ» и «410 KB», «2,4 МБ» и
   «2.4 MB», «в шесть раз легче» и «six times lighter». Отдельный словарь на
   версию, а не одна регулярка «на любой язык»: шаблон, принимающий и точку и
   запятую как разделитель, принял бы «2.4 МБ» — запись, которой нет ни в
   одном из двух языков, — и молча пропустил бы её на страницу.

   Английские числительные не совпадают с русскими один в один: `twice` не
   берёт слова `times`. Поэтому слово берётся из таблицы целиком, а шаблон
   только обрамляет его, — та же логика, что в `data/pageWeight.ts`. */
const RU_CLAIMS = {
  weight: /(\d+)\s*КБ/,
  weightHint: 'ожидалось «N КБ» в клетке data-cell="weight-ours"',
  median: /(\d+),(\d+)\s*МБ/,
  medianHint: 'ожидалось «N,N МБ» в клетке data-cell="weight-typical"',
  words: ['', '', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь',
    'девять', 'десять', 'одиннадцать', 'двенадцать'],
  phrase: (word) => new RegExp(`в\\s+${word}\\s+раз`, 'i'),
  phraseHint: (word) => `ожидалось «в ${word} раз(а) легче» в той же клетке`,
};
const EN_CLAIMS = {
  weight: /(\d+)\s*KB/,
  weightHint: 'ожидалось «N KB» в клетке data-cell="weight-ours"',
  median: /(\d+)\.(\d+)\s*MB/,
  medianHint: 'ожидалось «N.N MB» в клетке data-cell="weight-typical"',
  words: ['', '', 'twice', 'three times', 'four times', 'five times', 'six times',
    'seven times', 'eight times', 'nine times', 'ten times', 'eleven times',
    'twelve times'],
  phrase: (word) => new RegExp(`${word}\\s+lighter`, 'i'),
  phraseHint: (word) => `ожидалось «${word} lighter» в той же клетке`,
};
/* ПРАВКА 2026-08-26 (D-122, раздел 4.6 брифа страниц кейсов, правка 4) —
   список страниц был вписан руками (две штуки, `index.html`/`en/index.html`)
   и не мог включить страницу кейса `site-v3`, на которую та же правка ставит
   тот же рисунок: ловушка 15 из `50-code/CLAUDE.md` в чистом виде, второе
   срабатывание на этом же гейте (первое — список `PAGES` строкой выше).

   Признак хозяина страницы — по языку, а не по имени файла: любая страница
   под `en/` получает `EN_CLAIMS`, остальные — `RU_CLAIMS`. Это то же самое
   правило, что уже применяет `localeFromPath()` в рантайме (`i18n/
   locales.ts`) — здесь оно не импортируется (гейт не тянет TS-модули сайта),
   а переписано тем же условием на голом JS. */
function claimsForPage(page) {
  return page === 'en/index.html' || page.startsWith('en/') ? EN_CLAIMS : RU_CLAIMS;
}

/* Обязательный минимум — ОБЕ главные. Список проверяемых страниц выводится
   из разметки (наличие маркера ниже), но это свойство «на главной отсутствие
   рисунка — красный дефект» обязано остаться истинным даже если главная
   вдруг потеряет маркер вовсе: тогда искать нечего, а красноту дать всё
   равно необходимо. Поэтому эти два имени — не список объектов проверки
   (тот выводится из сборки), а список ГАРАНТИЙ покрытия, и вписаны они
   намеренно, тем же способом, что описан в разделе 4.6 брифа. */
const REQUIRED_WEIGHT_ILLUSTRATION_PAGES = new Set(['index.html', 'en/index.html']);
const WEIGHT_ILLUSTRATION_MARKER = 'data-illustration="case-weight"';

// Вырезает поддерево `<div …marker…>…</div>` из HTML по БАЛАНСУ тегов, а не
// по первому попавшемся `</div>` после маркера — разметка иллюстрации сама
// вложенная (`.bars` > `.bar-row` > `.track` > `.fill`), и наивный индекс
// оборвал бы срез на первом внутреннем div, а не на конце иллюстрации.
// Возвращает `null`, если маркер не найден на странице ИЛИ разметка не
// сбалансирована — оба случая гейт обязан считать красными, не пустыми.
function extractElementByMarker(html, marker) {
  const openTagRe = /<div\b[^>]*>/g;
  let openMatch;
  let elementStart = -1;
  let scanFrom = -1;
  while ((openMatch = openTagRe.exec(html))) {
    if (openMatch[0].includes(marker)) {
      elementStart = openMatch.index;
      scanFrom = openTagRe.lastIndex;
      break;
    }
  }
  if (elementStart === -1) return null;

  const tagRe = /<div\b[^>]*>|<\/div>/g;
  tagRe.lastIndex = scanFrom;
  let depth = 1;
  let tagMatch;
  while ((tagMatch = tagRe.exec(html))) {
    depth += tagMatch[0] === '</div>' ? -1 : 1;
    if (depth === 0) return html.slice(elementStart, tagRe.lastIndex);
  }
  return null;
}

/* Клетка иллюстрации «Замер» по машинному якорю `data-cell`. Якорь —
// атрибут, а не класс: класс принадлежит оформлению и не переживает
// перевёрстку, а гейт обязан пережить её или упасть, но не пройти молча.
// Срез идёт от начала тега клетки до начала СЛЕДУЮЩЕЙ клетки (или до конца
// иллюстрации) — так число из соседней клетки не может подвернуться под
// регулярку соседа. */
function extractCell(slice, key) {
  const start = slice.indexOf(`data-cell="${key}"`);
  if (start === -1) return null;
  const next = slice.indexOf('data-cell="', start + 1);
  return slice.slice(start, next === -1 ? slice.length : next);
}

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
// Тот же критерий «внешний адрес», что использует `resolveRef` при выборе
// файла на диске (протокол или `//` в начале) — вынесен отдельной функцией,
// потому что здесь он не решает, читать ли файл, а СЧИТАЕТ адреса, ничего не
// открывая на диске.
function isExternalRef(ref) {
  const clean = ref.trim().replace(/#.*$/, '');
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(clean);
}

function resolveRef(ref, baseDir) {
  const clean = ref.trim().replace(/#.*$/, ''); // фрагмент — не часть файла
  if (clean === '') return null;
  if (isExternalRef(clean)) return null; // внешний адрес, data:, mailto:
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

  // Сколько скриптов страница подключает с ЧУЖОГO домена. Считается заново
  // отдельным проходом по разметке (не переиспользует `queue` выше — та уже
  // опустошена `shift()`): `markupRefs` дешёвый регулярочный разбор, второй
  // проход не стоит усложнения.
  const thirdPartyScripts = markupRefs(html).filter(
    (r) => r.where === '<script src>' && isExternalRef(r.ref)
  ).length;

  const kb = (n) => `${(n / 1024).toFixed(1)} КБ`;
  const pageOk = total <= MAX_PAGE_BYTES;
  const jsOk = jsGzip <= MAX_JS_GZIP_BYTES;

  console.log(
    `${pageOk && jsOk ? '✓' : '✗'} ${page} — всего ${kb(total)} (предел ${kb(MAX_PAGE_BYTES)}), ` +
    `из них шрифты ${kb(fontBytes)}, JS сжатый ${kb(jsGzip)} (предел ${kb(MAX_JS_GZIP_BYTES)}), ` +
    `сторонних скриптов ${thirdPartyScripts}`
  );

  if (!pageOk || !jsOk) failed = true;

  /* Иллюстрация «Замер» несёт три утверждения о весе (вес, медиана,
     кратность) и строку мелких метрик (JS, сторонние скрипты) — все пять
     чисел обязаны иметь сторожа (раздел 3.2 брифа `02-case-illustrations
     .md`, «число без сторожа на рисунок не попадает»). Решение владельца
     2026-08-14 (пункт 7 списка правок) убрало прозаическую фразу-носитель
     этих чисел — сверка ведётся по СРЕЗУ разметки самой иллюстрации, вырезаемому
     по `WEIGHT_ILLUSTRATION_MARKER`, а не по первому совпадению где-то на
     странице. Это тот же класс дефекта, который здесь уже дважды чинили
     (флаг `i` у регулярки, кратность вне таблицы слов): «проверка есть,
     проверяет не то» — и на этот раз лечится не регуляркой точнее, а тем,
     что сверке вообще нечего искать вне этого среза. */
  /* Проверяется любая страница, чья разметка несёт маркер иллюстрации, ПЛЮС
     обе страницы обязательного минимума — даже если у одной из них маркер
     вдруг пропал (тогда `weightSlice` ниже будет `null`, и это красный
     дефект, а не тихо пропущенная проверка). */
  const hasIllustration = html.includes(WEIGHT_ILLUSTRATION_MARKER);
  const isRequired = REQUIRED_WEIGHT_ILLUSTRATION_PAGES.has(page);
  if (hasIllustration || isRequired) {
    const claims = claimsForPage(page);
    const weightSlice = extractElementByMarker(html, WEIGHT_ILLUSTRATION_MARKER);

    if (weightSlice === null) {
      console.error(
        `✗ ${page} — иллюстрация «Замер» (${WEIGHT_ILLUSTRATION_MARKER}) не найдена.\n` +
        '  Без её среза утверждения о весе, медиане и кратности некому сверять — ' +
        'это красный дефект, а не повод молча пропустить проверку.'
      );
      failed = true;
    } else {
      /* Композиция владельца 2026-08-19 (эскиз): четыре числа попарно —
         время и вес, наши и чужие, — стрелка по центру и вывод внизу.
         Сверять здесь можно ровно два числа и их частное: вес страницы,
         медиану и кратность. Время сюда не идёт и не может: гейт считает
         байты на диске, а время меряется браузером на канале — его сторож
         живёт отдельно (`src/tests/e2e/case-weight-load-time.spec.ts`) и
         сверяет НАПЕЧАТАННОЕ число с фактическим замером.

         Строки мелких метрик («N,N КБ JS · N сторонних скриптов») на рисунке
         больше нет — композиция владельца её не несёт, и вместе с ней ушли
         обе сверки. Правило «число без сторожа на рисунок не попадает» этим
         не ослаблено: ослабило бы его обратное — число на рисунке без
         сторожа. Сжатый вес JS и число сторонних скриптов гейт по-прежнему
         считает и печатает строкой сводки выше. */
      const oursCell = extractCell(weightSlice, 'weight-ours');
      const typicalCell = extractCell(weightSlice, 'weight-typical');
      const verdictCell = extractCell(weightSlice, 'verdict');
      const linkCell = extractCell(weightSlice, 'link');

      if (oursCell === null || typicalCell === null) {
        console.error(
          `✗ ${page} — в иллюстрации «Замер» не нашлись клетки веса ` +
          '(data-cell="weight-ours" / data-cell="weight-typical"). Разметка ' +
          'иллюстрации изменилась сильнее, чем сторож ожидал — поправить сторож ' +
          'вместе с разметкой.'
        );
        failed = true;
      }

      const weightClaim = oursCell !== null ? oursCell.match(claims.weight) : null;
      if (!weightClaim) {
        console.error(
          `✗ ${page} — иллюстрация «Замер» не называет вес страницы ` +
          `(${claims.weightHint}).`
        );
        failed = true;
      } else {
        const claimedKb = Number(weightClaim[1]);
        const actualKb = total / 1024;
        const drift = Math.abs(claimedKb - actualKb) / actualKb;
        if (drift > 0.05) {
          console.error(
            `✗ ${page} — иллюстрация «Замер» утверждает ${claimedKb} КБ, а страница весит ${kb(total)}. ` +
            'Разница больше 5%: подставить новое число в `data/pageWeight.ts` (константа веса этой ' +
            'страницы-хозяина — PAGE_WEIGHT_KB/PAGE_WEIGHT_KB_EN у главной, CASE_PAGE_WEIGHT_KB у ' +
            'кейса «site-v3») вместе с кратностью — они считаются только вместе.'
          );
          failed = true;
        }
      }

      const medianClaim = typicalCell !== null ? typicalCell.match(claims.median) : null;
      if (!medianClaim) {
        console.error(
          `✗ ${page} — иллюстрация «Замер» называет вес, но не называет медиану ` +
          `(${claims.medianHint}). Кратность сверить не с чем.`
        );
        failed = true;
      }

      const coefficientClaim = verdictCell !== null ? verdictCell.match(/(\d+)×/) : null;
      if (!coefficientClaim) {
        console.error(
          `✗ ${page} — вывод рисунка («N×» в клетке data-cell="verdict") не найден ` +
          'или не несёт числа.'
        );
        failed = true;
      }

      /* Кратность стоит на рисунке дважды — цифрой «6×» и словом «в шесть раз
         легче». Расхождение этих двух форм — молчаливый дефект ровно того
         класса, ради которого слово выводится из числа: сверяется здесь, на
         собранной странице, а не только в модуле, который их считает. */
      if (coefficientClaim) {
        const claimedRatio = Number(coefficientClaim[1]);
        const word = claims.words[claimedRatio];
        if (!word || !claims.phrase(word).test(verdictCell)) {
          console.error(
            `✗ ${page} — вывод рисунка утверждает ${claimedRatio}×, но словом этого не ` +
            `повторяет (${claims.phraseHint(word || '…')}). ` +
            'Цифра и слово разошлись — их обязан выводить один расчёт ' +
            '(data/pageWeight.ts, WEIGHT_MULTIPLIER_PHRASE).'
          );
          failed = true;
        }
      }

      /* Клетки `data-cell="link"` («ПОЛНАЯ ЗАГРУЗКА ПРИ 10 МБИТ/С») здесь
         БОЛЬШЕ НЕТ. Правка владельца 2026-08-21 сняла оговорку о канале с
         самого рисунка — решение осознанное, времена остаются без названного
         канала. Проверка развёрнута в обратную: клетки не должно быть, иначе
         снятие можно молча откатить, и никто не заметит. */
      if (linkCell !== null) {
        console.error(
          `✗ ${page} — на иллюстрации «Замер» снова появилась клетка ` +
          'data-cell="link" (оговорка о канале). Она снята правкой владельца ' +
          '2026-08-21 — либо откат ошибочен, либо решение владельца сменилось ' +
          'и сторож нужно поправить вместе с разметкой.'
        );
        failed = true;
      }

      // Кратность выведена из веса (`WEIGHT_MULTIPLIER`, `data/pageWeight
      // .ts`) — сверяется только когда все три числа найдены, иначе сверять
      // нечего и об этом уже сказано выше по каждому числу отдельно.
      if (weightClaim && medianClaim && coefficientClaim) {
        const claimedKb = Number(weightClaim[1]);
        const medianKb = (Number(medianClaim[1]) + Number(medianClaim[2]) / 10) * 1024;
        const claimedRatio = Number(coefficientClaim[1]);
        const expectedRatio = Math.round(medianKb / claimedKb);
        if (claimedRatio !== expectedRatio) {
          console.error(
            `✗ ${page} — вывод утверждает ${claimedRatio}×, а по факту медиана/вес даёт ` +
            `${expectedRatio}× (медиана ${medianClaim[1]},${medianClaim[2]} МБ, вес ${claimedKb} КБ). ` +
            'Кратность выводится из веса: подставить оба числа в `data/pageWeight.ts` вместе.'
          );
          failed = true;
        }
      }
    }
  }
  // Страницы без маркера (`contact/index.html`, `privacy/index.html` и
  // остальные) иллюстрацию «Замер» не несут по устройству — `hasIllustration`
  // выше для них `false`, `isRequired` тоже, и блок целиком пропускается. Это
  // законное, а не пропущенное отсутствие: список страниц, на которых рисунок
  // ЕСТЬ, выводится из разметки самой сборки (раздел 4.6 брифа страниц
  // кейсов, правка 4), а не перечисляется здесь руками.
}

if (failed) {
  console.error(
    '\nБюджет превышен. Либо чинить вес, либо снимать с сайта утверждение ' +
    '«вес страницы против медианы» — оно перестанет быть правдой.'
  );
  process.exit(1);
}

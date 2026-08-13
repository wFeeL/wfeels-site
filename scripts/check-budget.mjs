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

const PAGES = ['index.html', 'contact/index.html', 'privacy/index.html'];

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

  /* Иллюстрация «Замер» (`CaseWeightIllustration.astro`, секция кейсов
     главной) с 2026-08-13 печатает сжатый вес JS и число сторонних скриптов
     строкой мелких метрик — оба числа обязаны иметь сторожа на тех же
     основаниях, что вес страницы и кратность выше (раздел 3.2 брифа
     `02-case-illustrations.md`, «число без сторожа на рисунок не попадает»).

     Допуск не в процентах, как у веса страницы: 5% от ~2 КБ — это ~0,1 КБ,
     уже меньше точности округления до одного знака после запятой, которым
     печатается число. Сверяется поэтому не разница в проценте, а СОВПАДЕНИЕ
     округлённого до 0,1 КБ значения. */
  const jsClaim = html.match(/(\d+),(\d+)\s*КБ\s*JS\b/);
  if (jsClaim) {
    const claimedJsKb = Number(jsClaim[1]) + Number(jsClaim[2]) / 10;
    const actualJsKb = Math.round((jsGzip / 1024) * 10) / 10;
    if (Math.abs(claimedJsKb - actualJsKb) > 0.05) {
      console.error(
        `✗ ${page} — страница утверждает JS ${jsClaim[1]},${jsClaim[2]} КБ, а фактический ` +
        `сжатый JS — ${actualJsKb.toFixed(1)} КБ. Подставить новое число в data/pageWeight.ts ` +
        '(PAGE_JS_GZIP_KB).'
      );
      failed = true;
    }
  }

  const thirdPartyClaim = html.match(/(\d+)\s*сторонних\s*скрипт/i);
  if (thirdPartyClaim) {
    const claimedThirdParty = Number(thirdPartyClaim[1]);
    if (claimedThirdParty !== thirdPartyScripts) {
      console.error(
        `✗ ${page} — страница утверждает ${claimedThirdParty} сторонних скриптов, а по факту ` +
        `${thirdPartyScripts}. Подставить новое число в data/pageWeight.ts (THIRD_PARTY_SCRIPTS_COUNT).`
      );
      failed = true;
    }
  }

  /* Секция «Что можно проверить» называет вес этой самой страницы и во
     сколько раз она легче типичного сайта. Числа статические — их подставляет
     человек по выводу этого скрипта. Значит они могут устареть молча, и тогда
     сайт, чей главный тезис «каждое число проверяемо», станет утверждать вес,
     которого у него нет. Это самая неловкая из возможных здесь ошибок.
     Поэтому гейт, который вес и так измеряет, заодно сверяет утверждение. */
  // Флаг `i` — почина 2026-08-13 ([[02-case-illustrations.md]], раздел 3.2):
  // без него регулярка не находит «Весит N КБ» с прописной, и утверждение
  // остаётся без надзора молча — гейт продолжает печатать зелёную галочку,
  // хотя ни строку, ни кратность больше не проверяет. Красноту после
  // починки — заведомо неверный вес — проверял руками, см. отчёт задачи 3
  // плана (`70-workshop/specs/site-v3/02-case-illustrations.md`).
  const claim = html.match(/весит\s+(\d+)\s*КБ/i);
  if (claim) {
    const claimedKb = Number(claim[1]);
    const actualKb = total / 1024;
    const drift = Math.abs(claimedKb - actualKb) / actualKb;

    if (drift > 0.05) {
      console.error(
        `✗ ${page} — страница утверждает ${claimedKb} КБ, а весит ${kb(total)}. ` +
        'Разница больше 5%: подставить новое число в `data/proof.ts` вместе с ' +
        'кратностью — они считаются только вместе.'
      );
      failed = true;
    }

    /* Кратность выведена из веса, поэтому проверяется тем же заходом.

       Медиана берётся С САМОЙ СТРАНИЦЫ, а не из копии числа здесь. До правки
       2026-08-13 она была зашита сюда литералом `2.5 * 1024 * 1024` и жила
       ещё в двух местах — в `data/pageWeight.ts` и отдельной строкой в тексте
       утверждения. Когда 2026-08-13 нашёлся первоисточник (Web Almanac 2025,
       медиана десктопа 2 412 КБ, а не 2,5 МБ), стало видно, во что это
       обходится: три копии одного числа расходятся по одной, и та, что
       осталась в гейте, продолжила бы «подтверждать» отменённое значение.
       Теперь зарегистрированное значение одно (`data/pageWeight.ts`), а гейт
       сверяет напечатанное на странице с фактическим весом файла. */
    const WORDS = ['', '', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь',
      'восемь', 'девять', 'десять', 'одиннадцать', 'двенадцать', 'тринадцать'];
    const medianClaim = html.match(/—\s*(\d+),(\d+)\s*МБ/);
    const multiplier = html.match(/в\s+([а-яё]+)\s+раз\s+больше/i);

    if (!medianClaim) {
      console.error(
        `✗ ${page} — страница называет свой вес, но не называет медиану, с ` +
        'которой сравнивает себя. Кратность сверять не с чем, а значит ' +
        'утверждение «в N раз легче» осталось без надзора.'
      );
      failed = true;
    } else if (multiplier) {
      const medianKb = (Number(medianClaim[1]) + Number(medianClaim[2]) / 10) * 1024;
      const ratio = Math.round(medianKb / (total / 1024));

      /* Кратность вне списка слов — не повод промолчать. Прежняя редакция
         проверяла `WORDS[ratio] &&` и при выходе за таблицу пропускала
         сверку молча, продолжая печатать галочку: тот же класс дефекта
         («проверка есть, проверяет не то»), что и флаг `i` до починки. */
      if (!WORDS[ratio]) {
        console.error(
          `✗ ${page} — кратность ${ratio} вне таблицы слов (2…13). Либо ` +
          'страница неожиданно потяжелела, либо медиана прочитана неверно; ' +
          'в обоих случаях утверждение сверить нечем.'
        );
        failed = true;
      } else if (multiplier[1].toLowerCase() !== WORDS[ratio]) {
        console.error(
          `✗ ${page} — страница утверждает «в ${multiplier[1]} раз больше», ` +
          `а по факту в ${WORDS[ratio]} (${ratio}). Кратность выводится из веса: ` +
          'подставлять оба числа вместе.'
        );
        failed = true;
      }
    }
  }
}

if (failed) {
  console.error(
    '\nБюджет превышен. Либо чинить вес, либо снимать с сайта утверждение ' +
    '«вес страницы против медианы» — оно перестанет быть правдой.'
  );
  process.exit(1);
}

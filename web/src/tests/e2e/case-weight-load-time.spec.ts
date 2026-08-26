import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/* Сторож числа «0,4 с» на иллюстрации «Замер» (кейс «Этот сайт»).
 *
 * Зачем он вообще нужен. Все остальные числа этого рисунка выведены и потому
 * не могут разойтись с реальностью незаметно: вес считает `check-budget.mjs`
 * по байтам на диске, медиана — датированная внешняя ссылка, кратность и
 * слово «шесть» выводятся из двух весов. Время загрузки — единственное
 * ЗАМЕРЕННОЕ число рисунка, и без этого теста оно протухло бы молча: страница
 * потяжелела бы, а «0,4 с» осталось бы стоять и врать.
 *
 * Что именно он делает. Воспроизводит замер, которым число получено
 * (`data/pageWeight.ts`, `OUR_LOAD_SECONDS`): собранная страница, пустой кэш,
 * троттлинг CDP на 10 Мбит/с при RTT 40 мс, полная загрузка (`loadEventEnd`).
 * Сверяет медиану прогонов с числом, НАПЕЧАТАННЫМ на рисунке, — не с
 * константой из исходников. Это принципиально: врёт или не врёт именно то,
 * что видит человек, а константа могла бы разойтись с ним при любой правке
 * вёрстки.
 *
 * Канал и метрика зашиты здесь числами, а не читаются из модуля данных
 * намеренно: тест обязан воспроизводить УСЛОВИЯ замера, а не доверять их
 * описанию.
 *
 * Подписи «ПОЛНАЯ ЗАГРУЗКА ПРИ 10 МБИТ/С» на самом рисунке БОЛЬШЕ НЕТ.
 * Правка владельца 2026-08-21 сняла её осознанно: числа 0,362 с и 1,976 с
 * остаются на рисунке без названного канала. Тест по-прежнему воспроизводит
 * канал 10 Мбит/с числом ниже (`LINK_MBPS`) — это условие замера, не подпись,
 * — и дополнительно проверяет, что клетка `data-cell="link"` на рисунке не
 * появилась снова.
 */

/** Канал замера — то же число, что задаёт `LINK_MBPS` в `data/pageWeight.ts`.
 *  На рисунке подписью больше не печатается (снята 2026-08-21), но остаётся
 *  условием этого замера. */
const LINK_MBPS = 10;
/** Круговая задержка канала, мс — часть тех же условий. */
const LINK_RTT_MS = 40;

/** Прогоны: один разогревочный (первый запуск браузера всегда дороже — прогрев
 *  профиля, шрифтов, компиляции) плюс пять зачётных. Берётся МЕДИАНА, а не
 *  среднее: одиночный выброс на занятой машине не должен красить тест. */
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 5;

/* Допуск НЕсимметричный, и это решение, а не небрежность.
 *
 * Вверх — ±25 %: это и есть работа сторожа. Опасное направление ровно одно —
 * страница стала медленнее, чем о себе говорит; тогда число превращается в
 * рекламу, и тест обязан покраснеть. Разброс самого замера (0,349…0,409 с при
 * медиане 0,362) — около 8 %, остальные 17 % отданы дрожанию машины: на CI и
 * на занятом ноутбуке троттлинг задаёт канал, но не задаёт загрузку
 * процессора.
 *
 * Вниз — вдвое шире (0,55 от напечатанного). Страница, которая грузится
 * быстрее, чем обещает, никого не обманывает: занижать собственный результат
 * не грех. При этом нижняя граница не снята совсем — иначе число могло бы
 * протухнуть в другую сторону и годами преувеличивать нашу же медлительность.
 * Симметричные ±25 % здесь были бы МИГАЮЩИМ сторожем с первого дня:
 * воспроизведение замера на `astro preview` даёт 0,323…0,351 с при медиане
 * 0,347 — это уже 13 % ниже напечатанного «0,4», и достаточно страницы,
 * похудевшей на десяток килобайт, чтобы тест покраснел без всякой причины.
 * Проверено и обратное: с заведомо неверным «0,1 с» на рисунке тест падает
 * с сообщением «страница медленнее, чем о себе говорит — напечатано 0,1 с;
 * … медиана 0,347 с». */
const TOLERANCE_SLOWER = 1.25;
const TOLERANCE_FASTER = 0.55;

/** Один прогон: чистый контекст, пустой кэш, троттлинг, полная загрузка. */
async function measureLoadSeconds(context: BrowserContext, page: Page, path: string): Promise<number> {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: LINK_RTT_MS,
    downloadThroughput: (LINK_MBPS * 1000 * 1000) / 8,
    uploadThroughput: (LINK_MBPS * 1000 * 1000) / 8,
  });
  await page.goto(path, { waitUntil: 'load' });
  const ms = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return nav.loadEventEnd - nav.startTime;
  });
  await cdp.detach();
  return ms / 1000;
}

/* Рисунок стоит на ОБЕИХ главных и, с решения D-122 (раздел 4.6 брифа
 * страниц кейсов, правка 5), на странице кейса `site-v3` — а завтра может
 * встать и на любой другой странице. Список страниц ниже был рукописным
 * (`['/', '/en']`) и не мог узнать о новых хозяевах рисунка сам — ровно
 * ловушка 15 (`50-code/CLAUDE.md`): список объектов проверки, вписанный
 * руками, стареет молча в день, когда объектов становится больше. Список
 * выводится из СОБРАННОЙ страницы (маркер `data-illustration="case-weight"`),
 * тем же приёмом, что уже применяет `check-budget.mjs`.
 *
 * Английская версия печатает своё «0.4 s» с точкой вместо запятой; сверять
 * его с русским замером нельзя — это другая страница, и весит она на 18 КБ
 * меньше (`data/pageWeight.ts`, `PAGE_WEIGHT_KB_EN`). Замер повторяется для
 * каждой версии отдельно — тест ниже читает число СО СТРАНИЦЫ, а не из
 * исходников, поэтому какой бы хозяин ни оказался в списке, сверяется именно
 * то, что видит человек. */
const DIST = fileURLToPath(new URL('../../../dist/', import.meta.url));
const WEIGHT_ILLUSTRATION_MARKER = 'data-illustration="case-weight"';
/** Страницы, которые ОБЯЗАНЫ нести рисунок независимо от факта — тот же
 *  обязательный минимум, что в `check-budget.mjs`: отсутствие рисунка на
 *  главной остаётся красным дефектом, даже если у него по какой-то причине
 *  вдруг пропал маркер (тогда искать на странице нечего, а красноту дать
 *  всё равно необходимо). */
const REQUIRED_PAGES = ['/', '/en'];

function htmlFiles(dir: string, base = dir): string[] {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    if (entry.name === '_astro') return [];
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full, base);
    return entry.name.endsWith('.html') ? [relative(base, full)] : [];
  });
}

/** `index.html` → `/`, `en/index.html` → `/en`, `cases/site-v3/index.html`
 *  → `/cases/site-v3` — обратное тому, что Astro кладёт на диск для
 *  статического маршрута. */
function urlFromHtmlFile(relPath: string): string {
  const posix = relPath.split(sep).join('/');
  if (posix === 'index.html') return '/';
  if (posix.endsWith('/index.html')) return `/${posix.slice(0, -'/index.html'.length)}`;
  return `/${posix.replace(/\.html$/, '')}`;
}

if (!existsSync(DIST)) {
  throw new Error(
    `case-weight-load-time.spec.ts: сборка не найдена (${DIST}). Список страниц выводится ` +
    'из dist/ (ловушка 15, `50-code/CLAUDE.md`) — сначала `npm run build` в web/.',
  );
}

/* REQUIRED_PAGES попадают в список БЕЗУСЛОВНО — даже если у страницы почему-то
   пропал маркер. Тест ниже читает число со страницы через локатор
   `[data-cell="time-ours"] [data-count]`; если рисунка там нет вовсе, локатор
   не находится и тест падает красным сам по себе — это и есть требуемая
   красная реакция, без отдельной ветки «маркера нет, а страница обязательна». */
const PAGES = Array.from(new Set([
  ...htmlFiles(DIST)
    .filter((file) => readFileSync(join(DIST, file), 'utf8').includes(WEIGHT_ILLUSTRATION_MARKER))
    .map(urlFromHtmlFile),
  ...REQUIRED_PAGES,
])).sort();

test.describe('иллюстрация «Замер» — время загрузки не врёт', () => {
  for (const path of PAGES) {
  test(`медиана полной загрузки сходится с числом на рисунке (${path})`, async ({ browser }) => {
    test.setTimeout(180_000);

    /* `reducedMotion: 'reduce'` — не украшение теста, а условие корректного
       чтения. Контекст Playwright по умолчанию отдаёт `no-preference` (вопреки
       расхожему «headless всегда просит reduce» — проверено на этом наборе:
       без этой строки со страницы читалось «0,0 с», то есть кадр счётчика, а
       не напечатанное число). При `reduce` счётчик не запускается вовсе, и в
       узле стоит ровно то, что уехало в сборку. */
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    // Число читается СО СТРАНИЦЫ, а не из исходников: врёт или не врёт именно
    // то, что видит человек.
    await page.goto(path);
    const printed = (await page.locator('[data-cell="time-ours"] [data-count]').innerText()).trim();
    // Разделитель дробной части свой у каждого языка: «0,4 с» и «0.4 s».
    const claimed = Number(/^([\d.,]+)/.exec(printed)?.[1].replace(',', '.'));
    expect(Number.isFinite(claimed) && claimed > 0, `на рисунке не нашлось время загрузки: «${printed}»`)
      .toBe(true);

    // Правка владельца 2026-08-21: «Убираем надпись „ПОЛНАЯ ЗАГРУЗКА ПРИ
    // 10 МБИТ/С“». Решение осознанное — проверка развёрнута в обратную:
    // клетки `data-cell="link"` на рисунке быть не должно, иначе снятие
    // можно молча откатить, и никто не заметит. Канал замера (`LINK_MBPS`
    // выше) при этом воспроизводится по-прежнему — это условие теста, а не
    // текст на странице.
    expect(
      await page.locator('[data-cell="link"]').count(),
      'клетка data-cell="link" (оговорка о канале) обязана отсутствовать',
    ).toBe(0);

    const samples: number[] = [];
    for (let i = 0; i < WARMUP_RUNS + MEASURED_RUNS; i++) {
      const seconds = await measureLoadSeconds(context, page, path);
      if (i >= WARMUP_RUNS) samples.push(seconds);
    }
    await context.close();

    const sorted = [...samples].sort((a, b) => a - b);
    const median = sorted[(sorted.length - 1) >> 1];
    const report =
      `${path}: напечатано ${printed}; прогоны ${sorted.map((s) => s.toFixed(3)).join(' / ')} с; ` +
      `медиана ${median.toFixed(3)} с`;

    expect(
      median,
      `страница медленнее, чем о себе говорит — ${report}. Либо чинить вес, либо ` +
      'переизмерить и подставить новое число в `data/pageWeight.ts` (константа времени этой ' +
      'страницы-хозяина — OUR_LOAD_SECONDS у главной, CASE_OUR_LOAD_SECONDS у кейса «site-v3»).',
    ).toBeLessThanOrEqual(claimed * TOLERANCE_SLOWER);

    expect(
      median,
      `страница давно быстрее, чем о себе говорит — ${report}. Число протухло в свою ` +
      'невыгодную сторону: переизмерить и подставить в `data/pageWeight.ts` (та же константа ' +
      'времени, что и выше).',
    ).toBeGreaterThanOrEqual(claimed * TOLERANCE_FASTER);
  });
  }
});

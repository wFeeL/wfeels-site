import { test, expect, type Browser } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/* Сторож FOUC-подгонки запасных начертаний (заведён 2026-08-21, диагноз —
 * заголовок и метка бренда «прыгают» при подмене `system-ui` на настоящий
 * шрифт после его загрузки; расширен 2026-08-22 после того, как владелец
 * поймал дефект на 1000 px, а первая версия сторожа проверяла ОДНУ ширину
 * (1440) — та самая причина, по которой прыжок доехал до владельца, хотя
 * дизайн-ревью 2026-08-21 его уже видело. Полоса ширин ниже — из приёмки
 * задачи «прыжок на перезагрузке», не придумана заново.
 *
 * Мерит ИТОГ на каждой ширине отдельно, а не намерение: не ищет
 * `size-adjust` в CSS (наличие свойства ничего не говорит о том, верно ли
 * оно подобрано), а грузит страницу ДВАЖДЫ на каждой ширине в одном
 * прогоне — один раз с заблокированными `*.woff2` (что видит посетитель до
 * и во время `font-display: swap`), один раз как обычно, дожидаясь
 * `document.fonts.ready`, — и сравнивает реальную раскладку
 * `getBoundingClientRect()`/`scrollHeight`. Тот же метод и те же селекторы,
 * что у измерительного скрипта калибровки (временный, не входит в комплект),
 * которым подбирались числа в `fonts.css`.
 *
 * ВТОРАЯ ПРАВКА 2026-08-22 — ЗАМЕНА АГРЕГАТА НА СИМПТОМ. Первая версия
 * этой же правки проверяла высоту ВСЕГО документа (`document.documentElement.
 * scrollHeight`) порогом ≤24 px на каждой ширине и падала на шести ширинах
 * из двенадцати — не потому что что-то видимое сломано, а потому что
 * секции «Прайсинг» и «Обо мне» держат объяснённый, не устранённый разбором
 * в `fonts.css` (комментарий у `Onest Fallback`) остаток −24…−59 px
 * НЕЗАВИСИМО от `size-adjust` Onest на всём проверенном диапазоне 90…110% —
 * перенос там идёт не по ширине текста Onest, причина не найдена, и она не
 * закрывается подбором одного скаляра.
 *
 * Порог по высоте ВСЕГО документа недостижим в принципе одним `size-adjust`
 * Onest: перебор трёх значений на живой сборке (390 px / 1180+ px, дрейф
 * высоты документа) —
 *
 *   95%      →  −106 px / +110 px
 *   99,77%   →  −290 px /  +40 px
 *   102,63%  →  −136 px / +110 px
 *
 * — там, где выигрываешь на широких экранах, теряешь на узких, и наоборот:
 * одним числом ширину переноса чужой гарнитуры на всех ширинах не свести.
 * А ГЛАВНОЕ: высота документа — не то, что видит читатель при загрузке.
 * Прямой замер положения секций (подмена `--font-head` на голый Unbounded
 * без Fallback, чтобы увидеть сдвиг «из ниоткуда», тот же метод, что и
 * `size-adjust`-подгонка):
 *
 *   1440 px: hero/pain/services/pricing — сдвиг 0 px; первый сдвиг у cases
 *            (верх 4379→4403, +24), дальше process +24, guarantees +19,
 *            about +19, faq +78, contact +79;
 *   1000 px: те же первые четыре секции — 0; дальше −13, −12, −18, −17,
 *            +12, −23.
 *
 * То есть в поле зрения ПРИ ЗАГРУЗКЕ (первые один-два экрана — см. глубину
 * замера ниже) не двигается НИЧЕГО: `hero`/`pain`/`services`/`pricing`
 * держат 0 px на обеих проверенных ширинах. Сдвиги начинаются с высоты
 * около 4400 px — секций, к которым читатель доберётся, когда шрифты (45 КБ,
 * предзагружены) давно загрузились. Агрегат «высота документа» суммирует
 * этот невидимый нижний остаток вместе с видимым верхом и переоценивает
 * дефект: он падает там, где глазами смотреть не на что.
 *
 * ПОЭТОМУ сторож ниже проверяет не агрегат, а сам симптом — смещение КАЖДОЙ
 * секции верхнего уровня (`section[id]`, ровно те, что перечислены в
 * `lib/sections.ts`), чей верх при первой отрисовке (без шрифтов, то есть
 * то, что видит посетитель до и во время `font-display: swap`) лежит в
 * пределах ПЕРВЫХ ДВУХ высот окна. Две высоты, не одна: одна высота окна —
 * то, что видно без прокрутки в момент открытия страницы; вторая —
 * запас на случай, если читатель начал листать раньше, чем шрифты успели
 * замениться (шрифты лёгкие и предзагружены, но соединение или устройство
 * читателя может быть медленнее эталонного). Секция, чей верх ниже двух
 * высот окна, в момент подмены гарантированно вне вьюпорта независимо от
 * скорости чтения — её сдвиг для «прыжка на перезагрузке» не наблюдаем.
 *
 * Высота документа ОСТАЁТСЯ измеряемой и печатается в вывод теста как
 * справка (`console.log`, видно в отчёте прогона) — но не участвует в
 * `expect`: это не ослабление порога ради того, чтобы скрыть остаток
 * («Прайсинг»/«Обо мне» по-прежнему не исправлены и не отрицаются), а замена
 * измерения, которое отвечает не на тот вопрос, на измерение того, что
 * реально просил закрыть владелец, — «буквы не скачут при перезагрузке» на
 * ТОМ, что он видит, открыв страницу.
 *
 * Пороги — из приёмки задачи 2026-08-22: `h1` высота ≤4 px, `header .brand`
 * ширина ≤4 px, верх видимой секции ≤4 px, на КАЖДОЙ из двенадцати ширин
 * ниже — не только на концах полосы, как проверялось раньше. */

const SELECTORS = { h1: 'h1', brand: 'header .brand', sections: 'section[id]' } as const;

const THRESHOLDS = {
  h1HeightPx: 4,
  brandWidthPx: 4,
  sectionTopPx: 4,
} as const;

/* ПРАВКА 2026-08-23 — этот сторож проверял ТОЛЬКО главную, хотя каталог
 * вырос с семи страниц до семнадцати (сведение услуг, спека
 * `70-workshop/specs/site-v3/08-service-pages.md`): тот же класс, что и
 * ловушка 8 (`50-code/CLAUDE.md`) — предмет проверки зависит от параметра
 * («страница»), а покрыта была одна точка.
 *
 * Список страниц выводится обходом `dist/**\/*.html`, как и в `dist-
 * links.test.ts` / `focus-ring.spec.ts` — не вписан руками, значит не
 * протухнет при следующей новой странице. */
const DIST = fileURLToPath(new URL('../../../dist/', import.meta.url));

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

function routeFor(relPath: string): string {
  if (relPath === 'index.html') return '/';
  if (relPath.endsWith('/index.html')) return '/' + relPath.slice(0, -'index.html'.length - 1);
  return '/' + relPath;
}

/* `/dev/ui` — служебная витрина компонентов (`lib/dev-pages.ts`), в боевой
 * сборке маршрута НЕ существует: он появляется в `dist/` только когда сама
 * сборка запущена с `DEV_PAGES=1`, как делает `webServer` в этом
 * `playwright.config.ts` для нужд e2e. Найден на практике: обход дал 18
 * маршрутов вместо 17, потому что предыдущий прогон уже пересобрал `dist/`
 * с этим флагом и она осталась на диске к моменту сбора тестов. Исключение
 * поимённое: без него состав страниц зависел бы от того, кто последним
 * запускал сборку, а не от того, что реально публикуется. */
const EXCLUDED_ROUTES = new Set(['/dev/ui']);

const PAGES = htmlFiles(DIST)
  .map((f) => routeFor(f.slice(DIST.length)))
  .filter((route) => !EXCLUDED_ROUTES.has(route))
  .sort();

/* Полная полоса ширин остаётся ТОЛЬКО на главной — она самая сложная
 * раскладка сайта (десять секций, все компоненты) и именно на ней найден
 * дефект, ради которого сторож заведён (см. приёмку 2026-08-22 выше).
 * Гонять все двенадцать ширин ещё и по шестнадцати новым страницам — это
 * 17 × 12 × 2 замера, отдельный запуск браузера на каждый: раздутие времени
 * ради повторной проверки той же самой FOUC-подгонки `fonts.css`, которая
 * не зависит от страницы, только от ширины. Вместо этого у остальных
 * страниц — сокращённый набор из трёх ширин, по одной на каждый класс
 * раскладки сайта: 390 (мобильная, самый частый повод переноса строки в
 * `h1`), 768 (граница мобильной/десктопной раскладки, `--bp-md` в токенах),
 * 1440 (десктопная ширина, на которой набирались `size-adjust` в
 * `fonts.css`). Если подгонка снова разъедется на какой-то другой ширине
 * на КОНКРЕТНОЙ странице услуги, а не на главной, — это по определению
 * страничный, а не шрифтовой дефект (шрифты и their `size-adjust` общие
 * для всех страниц через `Base.astro`), и найдётся её собственной вёрсткой,
 * а не этим сторожем. */
const WIDTHS_HOME = [390, 480, 600, 768, 900, 1000, 1100, 1180, 1280, 1440, 1600, 1920] as const;
const WIDTHS_OTHER = [390, 768, 1440] as const;

function widthsFor(path: string): readonly number[] {
  return path === '/' ? WIDTHS_HOME : WIDTHS_OTHER;
}

/** Страницы, где `section[id]` законно отсутствует — простые
 *  одноэкранные страницы (юридические тексты, статус формы, сама 404,
 *  каталог услуг) не несут id-схему многосекционных страниц (главная и
 *  девять посадочных услуг). Сверено со сборкой 2026-08-23: у каждой из
 *  этих семи страниц `section id="…"` не встречается ни разу, у всех
 *  остальных десяти — встречается. Список поимённый и с причиной, а не
 *  молчаливый пропуск: если страница отсюда вдруг перестанет нести секции
 *  с `id` (или наоборот, страница НЕ из списка лишится их), `measure()`
 *  ниже бросает ошибку вместо тихого нуля — тот же принцип, что «список без
 *  запаса» в `dist-links.test.ts`. */
/* Список ручной: при добавлении новой языковой копии правовой или служебной
 * страницы его надо пополнять — обход `dist/**\/*.html` выше даёт состав
 * СТРАНИЦ, а не то, у каких из них законно нет `section[id]`. Английская
 * `404` лежит как `en/404/index.html` (каталог), а не файлом `en/404.html`,
 * как русская `404.html` в корне, — отсюда разные формы адреса ниже. */
const PAGES_WITHOUT_ID_SECTIONS = new Set([
  '/404.html', '/contact', '/privacy', '/terms', '/consent', '/thanks', '/services',
  '/en/404', '/en/privacy', '/en/terms', '/en/consent', '/en/thanks',
]);

/** Высота вьюпорта замера — используется и как `height` контекста браузера
 *  ниже, и как единица «двух высот окна» из комментария выше. Число одно —
 *  используется оттуда же, где задаётся сам вьюпорт, чтобы «две высоты» не
 *  разошлись с фактическим вьюпортом при будущей правке. */
const VIEWPORT_HEIGHT = 1000;
const VISIBLE_DEPTH_PX = VIEWPORT_HEIGHT * 2;

type Measured = {
  h1: { w: number; h: number };
  brand: { w: number; h: number };
  docHeight: number;
  sections: { id: string; top: number }[];
};

async function measure(
  browser: Browser,
  baseURL: string,
  path: string,
  width: number,
  blockFonts: boolean,
): Promise<Measured> {
  const ctx = await browser.newContext({
    viewport: { width, height: VIEWPORT_HEIGHT },
    // Безголовый Chromium по умолчанию просит `prefers-reduced-motion:
    // reduce` (см. `50-code/CLAUDE.md`, ловушка 5) — здесь нужен обычный
    // путь с движением, тот же, что видит живой посетитель.
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  if (blockFonts) {
    await page.route('**/*.woff2', (route) => route.abort());
  }
  await page.goto(new URL(path, baseURL).toString(), { waitUntil: 'load' });
  if (!blockFonts) {
    await page.evaluate(() => document.fonts.ready);
  }
  // Даёт осесть шрифту/раскладке после навигации, не привязан к какой-то
  // конкретной анимации страницы.
  await page.waitForTimeout(300);
  const out = await page.evaluate((sel) => {
    const box = (selector: string) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    };
    return {
      h1: box(sel.h1),
      brand: box(sel.brand),
      docHeight: document.documentElement.scrollHeight,
      sections: Array.from(document.querySelectorAll(sel.sections)).map((el) => ({
        id: el.id,
        top: el.getBoundingClientRect().top + window.scrollY,
      })),
    };
  }, SELECTORS);
  await ctx.close();
  if (!out.h1 || !out.brand) {
    throw new Error('не нашёлся h1 или header .brand — сторож проверяет не тот селектор');
  }
  if (out.sections.length === 0 && !PAGES_WITHOUT_ID_SECTIONS.has(path)) {
    throw new Error(
      `не нашлось ни одной section[id] на ${path} — сторож проверяет не тот селектор, ` +
      'либо страница законно лишилась секций и её нужно внести в PAGES_WITHOUT_ID_SECTIONS с причиной',
    );
  }
  return out as Measured;
}

test.describe('сборка построена и список страниц не пуст', () => {
  test('иначе сторож ослеп — сначала `npm run build`', () => {
    expect(
      PAGES.length,
      `нашлось ${PAGES.length} страниц в ${DIST} — сначала выполни \`npm run build\` в web/`,
    ).toBeGreaterThan(10);
    expect(PAGES, 'сама главная').toContain('/');
  });

  test('PAGES_WITHOUT_ID_SECTIONS не несёт несуществующих маршрутов', () => {
    for (const path of PAGES_WITHOUT_ID_SECTIONS) {
      expect(PAGES, `${path} нет среди построенных страниц`).toContain(path);
    }
  });
});

test.describe('FOUC — расхождение раскладки при подмене запасного начертания на настоящее', () => {
  for (const path of PAGES) {
    for (const width of widthsFor(path)) {
      test(`${path}: h1 / header .brand / видимые секции на ${width}px`, async ({ browser, baseURL }) => {
        test.skip(!baseURL, 'нет baseURL — playwright.config не поднял сервер');

        const withFonts = await measure(browser, baseURL!, path, width, false);
        const noFonts = await measure(browser, baseURL!, path, width, true);

        const h1Diff = Math.abs(withFonts.h1.h - noFonts.h1.h);
        const brandDiff = Math.abs(withFonts.brand.w - noFonts.brand.w);
        // Справочный агрегат — печатается, но не проверяется (см. комментарий
        // в начале файла: он суммирует невидимый нижний остаток вместе с
        // видимым верхом и переоценивает дефект).
        const docDiff = Math.abs(withFonts.docHeight - noFonts.docHeight);
        // eslint-disable-next-line no-console
        console.log(
          `[справка] ${path} — высота документа @${width}px: без шрифта ${noFonts.docHeight} px, ` +
            `со шрифтом ${withFonts.docHeight} px, дрейф ${docDiff.toFixed(2)} px`,
        );

        expect(
          h1Diff,
          `${path}: h1 @${width}px: без шрифта ${noFonts.h1.h.toFixed(2)} px, со шрифтом ${withFonts.h1.h.toFixed(2)} px`,
        ).toBeLessThanOrEqual(THRESHOLDS.h1HeightPx);

        expect(
          brandDiff,
          `${path}: header .brand @${width}px: без шрифта ${noFonts.brand.w.toFixed(2)} px, со шрифтом ${withFonts.brand.w.toFixed(2)} px`,
        ).toBeLessThanOrEqual(THRESHOLDS.brandWidthPx);

        // Секции сверху страницы всегда идут в одном порядке в обоих замерах
        // (`section[id]`, порядок разметки не зависит от шрифта) — сопоставляем
        // по индексу, а не по id, чтобы не ловить расхождение из-за отсутствия
        // секции в одном из двух прогонов молча. На страницах из
        // `PAGES_WITHOUT_ID_SECTIONS` `count` законно равен нулю — цикл ниже
        // просто не выполнится ни разу, это не пропуск проверки, а её
        // предмет отсутствует по устройству страницы.
        const count = Math.min(withFonts.sections.length, noFonts.sections.length);
        expect(
          count,
          `${path}: разное число section[id] в двух прогонах — сторож смотрит на нестабильную разметку`,
        ).toBe(Math.max(withFonts.sections.length, noFonts.sections.length));

        for (let i = 0; i < count; i++) {
          const withSec = withFonts.sections[i];
          const noSec = noFonts.sections[i];
          // Видимость определяем по положению БЕЗ шрифтов — это то, что
          // посетитель видит первым, ещё до подмены (см. комментарий в начале
          // файла про «две высоты окна»).
          if (noSec.top > VISIBLE_DEPTH_PX) continue;

          const topDiff = Math.abs(withSec.top - noSec.top);
          expect(
            topDiff,
            `${path}: секция «${noSec.id}» @${width}px (верх без шрифта ${noSec.top.toFixed(2)} px, ` +
              `в пределах ${VISIBLE_DEPTH_PX} px видимой глубины): верх без шрифта ` +
              `${noSec.top.toFixed(2)} px, со шрифтом ${withSec.top.toFixed(2)} px`,
          ).toBeLessThanOrEqual(THRESHOLDS.sectionTopPx);
        }
      });
    }
  }
});

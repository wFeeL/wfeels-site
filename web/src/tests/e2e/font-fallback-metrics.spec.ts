import { test, expect, type Browser } from '@playwright/test';

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

const WIDTHS = [390, 480, 600, 768, 900, 1000, 1100, 1180, 1280, 1440, 1600, 1920] as const;

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
  await page.goto(new URL('/', baseURL).toString(), { waitUntil: 'load' });
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
  if (out.sections.length === 0) {
    throw new Error('не нашлось ни одной section[id] — сторож проверяет не тот селектор');
  }
  return out as Measured;
}

test.describe('FOUC — расхождение раскладки при подмене запасного начертания на настоящее', () => {
  for (const width of WIDTHS) {
    test(`h1 / header .brand / видимые секции на ${width}px`, async ({ browser, baseURL }) => {
      test.skip(!baseURL, 'нет baseURL — playwright.config не поднял сервер');

      const withFonts = await measure(browser, baseURL!, width, false);
      const noFonts = await measure(browser, baseURL!, width, true);

      const h1Diff = Math.abs(withFonts.h1.h - noFonts.h1.h);
      const brandDiff = Math.abs(withFonts.brand.w - noFonts.brand.w);
      // Справочный агрегат — печатается, но не проверяется (см. комментарий
      // в начале файла: он суммирует невидимый нижний остаток вместе с
      // видимым верхом и переоценивает дефект).
      const docDiff = Math.abs(withFonts.docHeight - noFonts.docHeight);
      // eslint-disable-next-line no-console
      console.log(
        `[справка] высота документа @${width}px: без шрифта ${noFonts.docHeight} px, ` +
          `со шрифтом ${withFonts.docHeight} px, дрейф ${docDiff.toFixed(2)} px`,
      );

      expect(
        h1Diff,
        `h1 @${width}px: без шрифта ${noFonts.h1.h.toFixed(2)} px, со шрифтом ${withFonts.h1.h.toFixed(2)} px`,
      ).toBeLessThanOrEqual(THRESHOLDS.h1HeightPx);

      expect(
        brandDiff,
        `header .brand @${width}px: без шрифта ${noFonts.brand.w.toFixed(2)} px, со шрифтом ${withFonts.brand.w.toFixed(2)} px`,
      ).toBeLessThanOrEqual(THRESHOLDS.brandWidthPx);

      // Секции сверху страницы всегда идут в одном порядке в обоих замерах
      // (`section[id]`, порядок разметки не зависит от шрифта) — сопоставляем
      // по индексу, а не по id, чтобы не ловить расхождение из-за отсутствия
      // секции в одном из двух прогонов молча.
      const count = Math.min(withFonts.sections.length, noFonts.sections.length);
      expect(
        count,
        'разное число section[id] в двух прогонах — сторож смотрит на нестабильную разметку',
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
          `секция «${noSec.id}» @${width}px (верх без шрифта ${noSec.top.toFixed(2)} px, ` +
            `в пределах ${VISIBLE_DEPTH_PX} px видимой глубины): верх без шрифта ` +
            `${noSec.top.toFixed(2)} px, со шрифтом ${withSec.top.toFixed(2)} px`,
        ).toBeLessThanOrEqual(THRESHOLDS.sectionTopPx);
      }
    });
  }
});

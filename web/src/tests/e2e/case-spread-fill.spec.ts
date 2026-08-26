import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import {
  PAINT_FILL_MAX_RATIO,
  PAINT_FILL_THRESHOLD,
  PHOTO_MIN_IMG_WIDTH_RATIO,
  SCHEMA_MIN_HEIGHT_RATIO,
  SCHEMA_MIN_WIDTH_RATIO,
  countSvgCopies,
  distCasePages,
  distExists,
  measureLegacyDirectChildBbox,
  measurePaintFill,
} from './paintFill';

/* Главный сторож брифа страниц кейсов — 70-workshop/specs/site-v3/
 * 12-case-pages-brief.md, раздел 10.1. Способ замера назван у самого
 * измерителя (`paintFill.ts`, комментарий над `measurePaintFill`), а не
 * здесь — ловушка 2 (`50-code/CLAUDE.md`): «замер с прокруткой и замер сразу
 * после загрузки дают разные числа». Все замеры этого файла — БЕЗ
 * `scrollIntoViewIfNeeded()`, ровно так, как того требует раздел 10.1.3
 * («обходит панели без прокрутки к элементу, сразу после `load`», приём
 * З-1).
 *
 * Файл доказывает сторож на обоих концах (раздел 10.1.5 брифа):
 *   1. КРАСНЫЙ — на двух нарочно собранных образцах-ловушках (`page.set
 *      Content`, без сети и без сайта): обёртка-`div` во всю панель плюс
 *      настоящее содержимое сбоку/внутри. Старое правило (union bbox прямых
 *      потомков) их не видит — 99,0 %; новое видит.
 *   2. Отдельно — реконструкция исторического Б-1 (раздел 0.1 брифа):
 *      скрытая копия схемы идёт в разметке ПЕРВОЙ, видимая — второй.
 *      Старое наивное «взять первый попавшийся узел» объявило бы панель
 *      пустой (0×0); сторож обязан прочитать именно видимую копию.
 *   3. ЗЕЛЁНЫЙ — на живых галереях главной (`[data-website-gallery]`,
 *      `[data-storefront-gallery]`): это не панели разворотов кейсов (тех
 *      сегодня в сборке ещё нет — их верстает следующая задача), но это уже
 *      живые «настоящие кадры» с той же геометрией паспарту/рамки, что и
 *      берёт себе П-3, и на них проверяется, что сторож не красит зелёное в
 *      красный.
 *   4. Сама проверка `/cases/<slug>` и `/en/cases/<slug>` — по маркеру
 *      `[data-spread-frame]`, список страниц выводится из `dist/`
 *      (`distCasePages()`), а не вписан руками (ловушка 15/21). Сегодня
 *      разворотов в сборке нет — цикл ниже даёт 0 итераций, и это ожидаемо:
 *      разметка разворотов — предмет следующей задачи, не этой.
 */

test.describe('сторож заполнения панели — доказательство: красный на образцах-ловушках', () => {
  test('обёртка во всю панель + три чипа: старое правило зелёное, новое — красное', async ({ page }) => {
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;background:#fff;}
      .panel{width:678px;height:400px;box-sizing:border-box;background:#f5f5f5;position:relative;}
      .wrapper{width:100%;height:100%;box-sizing:border-box;padding:32px;display:flex;
        align-items:flex-start;gap:12px;}
      .chip{display:inline-flex;align-items:center;padding:8px 16px;border:1px solid #999;
        border-radius:999px;font:14px/1.2 sans-serif;background:#fff;white-space:nowrap;}
    </style></head><body>
      <div class="panel" data-panel>
        <div class="wrapper">
          <span class="chip">Один</span>
          <span class="chip">Два</span>
          <span class="chip">Три</span>
        </div>
      </div>
    </body></html>`);

    const panel = page.locator('[data-panel]');
    const legacy = await panel.evaluate(measureLegacyDirectChildBbox);
    const fresh = await panel.evaluate(measurePaintFill);

    console.log(
      `[case-spread-fill] обёртка + три чипа — A (старое) ${(legacy.ratio * 100).toFixed(1)}%, ` +
      `B (новое) ${(fresh.ratio * 100).toFixed(1)}% (${fresh.paintWidth.toFixed(1)} × ${fresh.paintHeight.toFixed(1)})`,
    );

    // Старое правило видело саму обёртку (прямой видимый потомок панели) —
    // она занимает панель целиком, отсюда ~99–100 %. Это и есть дефект D-120.
    expect(legacy.ratio).toBeGreaterThan(0.9);
    // Новое правило спускается сквозь обёртку и видит только три чипа —
    // заведомо ниже порога 60 %.
    expect(fresh.ratio).toBeLessThan(PAINT_FILL_THRESHOLD);
    expect(fresh.ratio).toBeGreaterThan(0); // не «пусто», а именно «мало»
  });

  test('обёртка во всю панель + svg 600×600 с прямоугольником 60×40: старое зелёное, новое красное', async ({ page }) => {
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;background:#fff;}
      .panel{width:678px;height:678px;box-sizing:border-box;background:#f5f5f5;position:relative;}
      .wrapper{width:100%;height:100%;box-sizing:border-box;}
      svg{display:block;width:100%;height:100%;}
    </style></head><body>
      <div class="panel" data-panel>
        <div class="wrapper">
          <svg viewBox="0 0 600 600" preserveAspectRatio="none">
            <rect x="270" y="280" width="60" height="40" fill="#000"/>
          </svg>
        </div>
      </div>
    </body></html>`);

    const panel = page.locator('[data-panel]');
    const legacy = await panel.evaluate(measureLegacyDirectChildBbox);
    const fresh = await panel.evaluate(measurePaintFill);

    console.log(
      `[case-spread-fill] обёртка + svg viewBox 600×600, rect 60×40 — A (старое) ` +
      `${(legacy.ratio * 100).toFixed(1)}%, B (новое) ${(fresh.ratio * 100).toFixed(1)}% ` +
      `(${fresh.paintWidth.toFixed(1)} × ${fresh.paintHeight.toFixed(1)})`,
    );

    // Старое правило мерило бокс самого <svg> (100 % ширины/высоты обёртки) —
    // ровно вторая тавтология, снятая D-120.
    expect(legacy.ratio).toBeGreaterThan(0.9);
    // Новое правило переводит getBBox() через viewBox и видит только
    // прямоугольник 60×40 из холста 600×600 — доли процента.
    expect(fresh.ratio).toBeLessThan(PAINT_FILL_THRESHOLD);
    expect(fresh.ratio).toBeGreaterThan(0);
  });

  test('Б-1: скрытая копия схемы идёт в разметке первой — сторож читает видимую, а не объявляет панель пустой', async ({ page }) => {
    // Реконструкция раздела 0.1 брифа: «панель на 390 px пуста, svg 0×0» —
    // артефакт замера, который читал ПЕРВЫЙ узел в разметке, а первым была
    // скрытая (display:none) копия. Здесь скрытая копия стоит первой и несёт
    // ЗАВЕДОМО пустой прямоугольник, видимая — второй и несёт настоящий кадр.
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;background:#fff;}
      .panel{width:678px;height:400px;box-sizing:border-box;background:#f5f5f5;position:relative;}
      .wrapper{width:100%;height:100%;box-sizing:border-box;}
      svg{display:block;width:100%;height:100%;}
    </style></head><body>
      <div class="panel" data-panel>
        <div class="wrapper">
          <svg class="ra" viewBox="0 0 600 400" preserveAspectRatio="none" style="display:none">
            <rect x="0" y="0" width="0" height="0" fill="#000"/>
          </svg>
          <svg class="rb" viewBox="0 0 600 400" preserveAspectRatio="none">
            <rect x="20" y="20" width="560" height="360" fill="#000"/>
          </svg>
        </div>
      </div>
    </body></html>`);

    const panel = page.locator('[data-panel]');
    const fresh = await panel.evaluate(measurePaintFill);
    const svgCopies = await panel.evaluate(countSvgCopies);

    console.log(
      `[case-spread-fill] Б-1: скрытая копия первой — заполнение ${(fresh.ratio * 100).toFixed(1)}%, ` +
      `копий <svg> в панели: ${svgCopies}`,
    );

    // Ровно симптом Б-1: наивный «первый узел» дал бы 0×0 и объявил панель
    // пустой. Сторож обязан прочитать видимую копию и получить высокое число.
    expect(fresh.ratio).toBeGreaterThan(PAINT_FILL_THRESHOLD);
    // И отдельно — запрет из раздела 2 брифа («ОДНА копия разметки»): панель
    // несёт две копии <svg> одновременно (одна скрыта), это дефект, даже
    // когда заполнение само по себе зелёное.
    expect(svgCopies, 'схема обязана нести ровно одну копию разметки').toBeGreaterThan(1);
  });
});

test.describe('сторож заполнения панели — доказательство: зелёный на живых галереях главной', () => {
  /* Это не панели [data-spread-frame] — их в сборке ещё нет (следующая
   * задача верстает сами развороты). Это уже опубликованные секции главной
   * с настоящими кадрами (паспарту/рамка/`overflow:clip`, как того требует
   * П-3 у панелей разворота) — на них проверяется, что тот же измеритель не
   * красит зелёное в красный. */
  const CASES: Array<{ name: string; selector: string; widths: number[] }> = [
    { name: 'галерея сайтов (websites)', selector: '[data-website-gallery]', widths: [1440, 390] },
    { name: 'галерея витрин (storefront)', selector: '[data-storefront-gallery]', widths: [1440, 390] },
  ];

  for (const { name, selector, widths } of CASES) {
    for (const width of widths) {
      test(`${name} — заполнение ≥ ${PAINT_FILL_THRESHOLD * 100}% на ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/');
        const gallery = page.locator(selector);
        // Секция ниже первого экрана — единственная прокрутка во всём файле,
        // и она сюда: карусель грузит первый кадр по IntersectionObserver, а
        // без появления в области видимости `[data-website-gallery]` вообще
        // не подставит src (`data-loaded="false"` навсегда). Замер после
        // этого — тот же «сразу после появления», а не «с дополнительной
        // прокруткой к внутренностям».
        await gallery.scrollIntoViewIfNeeded();
        if (await gallery.getAttribute('data-defer')) {
          await expect(gallery).toHaveAttribute('data-loaded', 'true');
        }

        const legacy = await gallery.evaluate(measureLegacyDirectChildBbox);
        const fresh = await gallery.evaluate(measurePaintFill);
        console.log(
          `[case-spread-fill] ${name} @ ${width}px — A ${(legacy.ratio * 100).toFixed(1)}%, ` +
          `B ${(fresh.ratio * 100).toFixed(1)}%`,
        );

        expect(fresh.ratio).toBeGreaterThanOrEqual(PAINT_FILL_THRESHOLD);
      });
    }
  }
});

test.describe('приложение — находка брифа: «Замер» в поле 384 (главная, вне поверхности этого брифа)', () => {
  /* Раздел 1 брифа: главная в его «поверхность» НЕ входит, и красное число
   * здесь — не повод переверстать главную (раздел 10.1.5, последний абзац).
   * Проверка оставлена как ПОДТВЕРЖДЕНИЕ находки, а не как требование:
   * `.field` вокруг иллюстрации «Замер» несёт ФИКСИРОВАННУЮ высоту 384 px
   * (`ILLUSTRATION_HEIGHT['site-v3']` в `Cases.astro`), рисунок в неё не
   * растянут, и заполнение оттого ниже порога. Раздел 4.5 брифа переносит
   * рисунок в панель разворота отдельной задачей — здесь рисунок и разметка
   * НЕ ТРОГАЮТСЯ, только измерены. Если однажды это число уйдёт выше
   * порога само — тест начнёт падать, и это сигнал сверить с 4.5, а не
   * ослаблять сторож. */
  test.use({ reducedMotion: 'reduce' });
  const ILLO = '[data-illustration="case-weight"]';

  for (const width of [1440, 390]) {
    test(`поле «Замера» на главной ниже порога на ${width}px — известная находка, не дефект сторожа`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const field = page.locator(ILLO).locator('xpath=ancestor::div[contains(@class,"field")][1]');
      const fresh = await field.evaluate(measurePaintFill);
      console.log(
        `[case-spread-fill] «Замер» в поле 384 @ ${width}px — заполнение ${(fresh.ratio * 100).toFixed(1)}%`,
      );
      expect(fresh.ratio).toBeLessThan(PAINT_FILL_THRESHOLD);
    });
  }
});

/* --------------------------------------------------------------------------
 * Сторож `[data-spread-frame]` — /cases/<slug> и /en/cases/<slug>.
 *
 * Список страниц читается из `dist/` (`distCasePages()`), а не вписан
 * руками (ловушка 15/21, `50-code/CLAUDE.md`): на сайте сегодня 29 страниц,
 * не 24, и число будет меняться дальше без правки этого файла.
 *
 * Разворотов в разметке кейсов сегодня нет — их верстает следующая задача
 * (границы этого брифа: «Разворотов не строй»). Цикл ниже поэтому даёт 0
 * тестов сегодня и это ожидаемо; он активируется сам, без правки, в день,
 * когда `[data-spread-frame]` появится на странице.
 * ------------------------------------------------------------------------*/
const CASE_PAGES = distExists() ? distCasePages() : [];

/** Проектная полоса ширины кадра трио-ленты (≤599px, раздел 3.3 брифа):
 *  `flex: 0 0 78%` в `CaseSpread.astro` — не приблизительно, а точное
 *  значение, замер даёт 0,7799…0,7800 на 390 и 599px. Полоса ±1 п.п. вокруг
 *  78% (раздел 10.1.3-а брифа): проект округляет геометрию к 8-px сетке
 *  (раздел 3.4), значит самая вероятная будущая ошибка — сдвиг ровно на один
 *  шаг сетки. Один шаг это `8 / 358 = 2,23` п.п. на узкой ширине (390px) и
 *  `8 / 551 = 1,45` п.п. на широкой (599px, полоса содержимого 551px).
 *  Прежний допуск ±3 п.п. (0,75…0,81) пропускал бы такую ошибку зелёной на
 *  обеих ширинах; ±1 п.п. ловит её на обеих. Хрупкости к субпиксельному
 *  округлению это не создаёт: снизу полоса всё равно в сто раз шире
 *  наблюдаемого разброса — замер даёт 0,7799…0,7800 на двух ширинах, то есть
 *  разброс 0,01 п.п. Побочно ужесточение возвращает ленте то, что правило
 *  95% (10.1.3) охраняет у сплошной панели, — запрет внутреннего отступа:
 *  отступ `p` с каждой стороны даёт `0,78 × (358 − 2p) / 358`; при нижней
 *  границе 77% он ловится начиная с p ≥ 2,3px, при прежних 75% — только
 *  с p ≥ 6,9px. */
const TRIO_RIBBON_IMG_WIDTH_MIN = 0.77;
const TRIO_RIBBON_IMG_WIDTH_MAX = 0.79;

for (const url of CASE_PAGES) {
  test(`панели разворота заполнены — ${url}`, async ({ page }) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      // Без прокрутки к элементу, сразу после load — З-1, раздел 10.1.3.
      await page.goto(url, { waitUntil: 'load' });

      const frames = page.locator('[data-spread-frame]');
      const count = await frames.count();
      for (let i = 0; i < count; i++) {
        const frame = frames.nth(i);
        const label = `${url} @ ${width}px, панель ${i + 1}/${count}`;

        const svgCopies = await frame.evaluate(countSvgCopies);
        expect(svgCopies, `${label}: схема обязана нести ровно одну копию разметки`).toBeLessThanOrEqual(1);

        const fresh = await frame.evaluate(measurePaintFill);
        console.log(`[case-spread-fill] ${label} — заполнение ${(fresh.ratio * 100).toFixed(1)}%`);
        expect(fresh.ratio, `${label}: заполнение 0 — в панели нет ни одного видимого листового узла`)
          .toBeGreaterThan(0);
        expect(fresh.ratio, `${label}: заполнение ${(fresh.ratio * 100).toFixed(1)}% ниже порога ${PAINT_FILL_THRESHOLD * 100}%`)
          .toBeGreaterThanOrEqual(PAINT_FILL_THRESHOLD);
        // Верхняя граница (порог и обоснование — `paintFill.ts`, комментарий
        // над `PAINT_FILL_MAX_RATIO`): после обрезки боксов по клипующим
        // предкам заполнение выше 101% значит либо сломанную обрезку, либо
        // содержимое, которое физически вылезает за раму панели БЕЗ
        // клипующего предка между собой и панелью.
        expect(fresh.ratio, `${label}: заполнение ${(fresh.ratio * 100).toFixed(1)}% выше верхней границы ${PAINT_FILL_MAX_RATIO * 100}%`)
          .toBeLessThanOrEqual(PAINT_FILL_MAX_RATIO);

        const panelBox = await frame.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { width: r.width, height: r.height };
        });

        const hasImg = (await frame.locator('img').count()) > 0;
        if (hasImg) {
          const imgWidth = await frame.evaluate((el) => el.querySelector('img')?.getBoundingClientRect().width ?? 0);
          // Трио-лента (≤599px, раздел 3.3 брифа) — особый случай: кадр
          // НАРОЧНО занимает 78% полосы, чтобы следующий выглядывал краем
          // (это и есть предмет задачи, закрытой в этой правке — сторож
          // «трио-лента … выглядывает краем» ниже). Порог 95% из 10.1.3
          // рассчитан на панель со сплошным снимком, где кадр — это вся
          // панель; для ленты он бы требовал ИМЕННО дефект, который здесь
          // чинится, поэтому для неё действует отдельная, узкая полоса
          // вокруг 78% (`flex: 0 0 78%` в `CaseSpread.astro`), а не 95%.
          const isRibbon = await frame.evaluate((el) => {
            const trio = el.querySelector('.shots.trio');
            return trio ? getComputedStyle(trio).display === 'flex' : false;
          });
          if (isRibbon) {
            const ratio = imgWidth / panelBox.width;
            expect(ratio, `${label}: кадр трио-ленты ${(ratio * 100).toFixed(1)}% — ниже проектной полосы ${TRIO_RIBBON_IMG_WIDTH_MIN * 100}…${TRIO_RIBBON_IMG_WIDTH_MAX * 100}% (78% ± допуск)`)
              .toBeGreaterThanOrEqual(TRIO_RIBBON_IMG_WIDTH_MIN);
            expect(ratio, `${label}: кадр трио-ленты ${(ratio * 100).toFixed(1)}% — выше проектной полосы ${TRIO_RIBBON_IMG_WIDTH_MIN * 100}…${TRIO_RIBBON_IMG_WIDTH_MAX * 100}% (78% ± допуск)`)
              .toBeLessThanOrEqual(TRIO_RIBBON_IMG_WIDTH_MAX);
          } else {
            expect(imgWidth / panelBox.width, `${label}: ширина <img> ниже ${PHOTO_MIN_IMG_WIDTH_RATIO * 100}% ширины панели`)
              .toBeGreaterThanOrEqual(PHOTO_MIN_IMG_WIDTH_RATIO);
          }
        }

        if (svgCopies > 0) {
          expect(fresh.paintWidth / panelBox.width, `${label}: схема ниже ${SCHEMA_MIN_WIDTH_RATIO * 100}% ширины панели`)
            .toBeGreaterThanOrEqual(SCHEMA_MIN_WIDTH_RATIO);
          expect(fresh.paintHeight / panelBox.height, `${label}: схема ниже ${SCHEMA_MIN_HEIGHT_RATIO * 100}% высоты панели`)
            .toBeGreaterThanOrEqual(SCHEMA_MIN_HEIGHT_RATIO);
        }
      }
    }
  });
}

/* --------------------------------------------------------------------------
 * Раздел 3.3 брифа, дефект найден и закрыт в этой задаче: на ≤599px трио-
 * лента (`.shots.trio { display: flex; overflow-x: auto }`) обязана
 * показывать край СЛЕДУЮЩЕГО кадра при `scrollLeft = 0` — иначе читатель не
 * понимает, что лента вообще прокручивается. Было: `flex: 0 0 78%` не
 * действовал — общее правило `.frame img { width: 100% }` задавало
 * «специфицированную» ширину, автоматический минимум флекс-элемента
 * (`min-width: auto`, спецификация п. 4.5) вычислялся из неё и перебивал
 * `flex-basis`, каждый `<img>` занимал 100% ленты, кадры лежали встык без
 * зазора обзора. Правило `.shots.trio img { min-width: 0 }` выключает этот
 * автоматический минимум.
 *
 * Порог N = 24px (раздел 10.1.3-а брифа): прежнее обоснование «заведомо
 * больше зазора 16px» не годится — измеряется
 * `containerRect.right − second.left`, то есть СОБСТВЕННАЯ видимая ширина
 * второго кадра, а зазор `gap: 16px` в неё вообще не входит, значит
 * сравнение с зазором сравнивало разные величины.
 *
 * Верный довод геометрический: у кадра радиус `--radius-md` = 12px
 * (`web/src/styles/tokens.css:73`). Полоска шириной меньше радиуса — это
 * одна дуга скругления, глаз читает её как артефакт скруглённой кромки, а
 * не как край следующего кадра. Порог = 2 × радиус = 24px: половина полоски
 * приходится на прямую вертикальную кромку, и видимый край перестаёт быть
 * дугой. Запас к факту сохраняется — 62,8 / 24 = 2,6× на самой узкой из двух
 * проверяемых ширин (390px даёт 62,8px, 599px — 105,2px, замер
 * `getBoundingClientRect()` до правки и после — см. комментарий в
 * `CaseSpread.astro`), но порог больше не привязан к самому измеренному
 * значению — он переживёт смену пропорции кадра ленты (лента получит и
 * портреты 780×1688, раздел 3.5 брифа).
 *
 * Два числа этого файла (полоса ширины кадра выше и этот порог) не дублируют
 * друг друга: полоса ширины стережёт ПРИЧИНУ — проектную пропорцию кадра
 * ленты; порог края стережёт СЛЕДСТВИЕ — то, что видит читатель. Следствие
 * останется верным критерием и после того, как пропорция кадра будет
 * пересмотрена, а причина ловит ошибку раньше, чем она станет заметна глазом.
 *
 * Список страниц — из `dist/` (ловушка 15/21, `50-code/CLAUDE.md`), не
 * вписан руками: сегодня трио несёт только `zayavka-hub`, бриф отдаёт его
 * всем пяти кейсам следующей задачей, и цикл подхватит их сам.
 * ------------------------------------------------------------------------*/
const TRIO_PEEK_MIN_PX = 24;

for (const url of CASE_PAGES) {
  for (const width of [390, 599]) {
    test(`трио-лента ${url} @ ${width}px — следующий кадр выглядывает краем не меньше ${TRIO_PEEK_MIN_PX}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url, { waitUntil: 'load' });

      const trios = page.locator('.shots.trio');
      const count = await trios.count();
      for (let i = 0; i < count; i++) {
        const trio = trios.nth(i);
        const label = `${url} @ ${width}px, лента ${i + 1}/${count}`;
        const measured = await trio.evaluate((el) => {
          const imgs = el.querySelectorAll('img');
          if (imgs.length < 2) return null;
          const containerRect = el.getBoundingClientRect();
          const second = imgs[1].getBoundingClientRect();
          return { scrollLeft: el.scrollLeft, peek: containerRect.right - second.left };
        });
        if (measured === null) continue; // меньше двух кадров — выглядывать нечему

        expect(measured.scrollLeft, `${label}: замер обязан идти при scrollLeft = 0`).toBe(0);
        console.log(`[case-spread-trio-peek] ${label} — второй кадр виден на ${measured.peek.toFixed(1)}px`);
        expect(measured.peek, `${label}: второй кадр виден лишь на ${measured.peek.toFixed(1)}px — ниже порога ${TRIO_PEEK_MIN_PX}px`)
          .toBeGreaterThanOrEqual(TRIO_PEEK_MIN_PX);
      }
    });
  }
}

/* --------------------------------------------------------------------------
 * 10.1.3, пункт 1: у `.spread-frame` не должно быть фиксированного `height`
 * / `min-height` — тот же приём, что раздел 10.4 уже применяет к `min-
 * height` в `[slug].astro` («сторож — grep по исходнику»): вычисленный
 * стиль в браузере не отличает «auto, вычислившийся в 480px» от «480px,
 * заданных явно», поэтому проверяется САМ исходник, а не готовый DOM.
 * ------------------------------------------------------------------------*/
function spreadFrameFixedHeightViolations(): string[] {
  const srcRoot = fileURLToPath(new URL('../../', import.meta.url)); // web/src/
  const violations: string[] = [];

  function walk(dir: string) {
    let entries: import('node:fs').Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(astro|css)$/.test(entry.name)) continue;
      const content = readFileSync(full, 'utf8');
      // Наивная де-вложенность: `@media (...) { .sel { height: 1px } }`
      // содержит корректный внутренний блок `.sel { height: 1px }` как
      // непрерывную подстроку без фигурных скобок внутри — регулярка его
      // находит независимо от внешней обёртки @media.
      const ruleRegex = /([^{}]+)\{([^{}]*)\}/g;
      let match: RegExpExecArray | null;
      while ((match = ruleRegex.exec(content))) {
        const [, selector, body] = match;
        if (!/spread-frame/.test(selector)) continue;
        const declRegex = /(?:^|[;\s])(height|min-height)\s*:\s*([^;]+);?/g;
        let decl: RegExpExecArray | null;
        while ((decl = declRegex.exec(body))) {
          const prop = decl[1];
          const value = decl[2].trim();
          if (value === 'auto' || value === '0' || value === '0px') continue;
          violations.push(`${relative(srcRoot, full)}: .spread-frame { ${prop}: ${value} }`);
        }
      }
    }
  }

  walk(srcRoot);
  return violations;
}

test('.spread-frame не несёт фиксированный height/min-height (10.1.3, П-3)', () => {
  const violations = spreadFrameFixedHeightViolations();
  expect(violations, `панель разворота обязана расти под содержимое:\n${violations.join('\n')}`).toEqual([]);
});

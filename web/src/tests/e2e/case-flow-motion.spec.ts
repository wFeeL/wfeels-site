import { test, expect, type Page } from '@playwright/test';
import { routeWithMarker, htmlForMarker } from './illustrationRoute';

/* Адрес страницы, на которой сегодня выведен рисунок. Правка владельца
 * 2026-08-20 сняла кейс «Заявка-Хаб» с главной: сегодня такой страницы нет, и
 * весь набор спит — не удалён и не подогнан под пустоту. Появится страница
 * каталога кейсов (спека 04) — прогон проснётся сам и пойдёт на неё.
 * Пояснение механизма — `illustrationRoute.ts`. */
const ROUTE = routeWithMarker('data-case-flow');
test.skip(ROUTE === null, 'кейс «Заявка-Хаб» снят с главной 2026-08-20 (правка владельца), и ни одна страница сборки его рисунок не выводит: набор проснётся со страницей каталога кейсов');

/* Страница, которую нашёл ROUTE, — панель разворота кейса `/cases/zayavka-
 * hub` (`CaseSpread.astro`), не прежняя секция главной. Компонент там
 * работает в режиме ОДНОЙ копии разметки (`single="b"`, брифа `70-workshop/
 * specs/site-v3/12-case-pages-brief.md`, раздел 2, П-3): раскрой `.ra`
 * физически не рендерится (см. `CaseFlowIllustration.astro`, разметка
 * `{single !== 'b' && (…)}`), и прогрессивная прорисовка линий по прокрутке
 * снята для этого режима намеренно (комментарий в `CaseFlowIllustration.
 * astro` у блока `@supports`: «здесь его лечит не JS-триггер, а снятие
 * привязки к прокрутке»). Это НЕ регрессия «схемы на главной» — компонент
 * не выводится на главной с 2026-08-20, задолго до этой ветки (тот же факт
 * зафиксирован комментарием в `Cases.astro`: «Здесь они больше не
 * импортируются»); это первое реальное пробуждение спящего прогона на новой,
 * умышленно другой поверхности. Критерии `.ra`-раскроя и дуального
 * переключения по ширине ниже поэтому идут только когда `.ra` физически
 * есть в разметке найденной страницы — сегодня это не так, и они спят тем же
 * приёмом, что и весь файл целиком (см. `IS_SINGLE_B`). Это находка,
 * доложенная отдельно, а не тихая правка спека под баг. */
const ROUTE_HTML = ROUTE === null ? null : htmlForMarker('data-case-flow');
const IS_SINGLE_B = ROUTE_HTML !== null && /data-single="b"/.test(ROUTE_HTML);

/* Движение иллюстрации «Заявка-Хаб» — бриф `70-workshop/specs/site-v3/
 * 07-flow-motion-brief.md`, раздел 15 (критерии 1–7). Прежняя редакция этого
 * файла держалась за селектор `.pkt.k-rt` и за движение по прокрутке;
 * ни того, ни другого больше нет: пакет один на раскрой, едет по ВРЕМЕНИ
 * (`offset-path` + `offset-distance`, период 9 с), а по прокрутке рисуются
 * только линии (и только вне режима `single="b"` — см. `IS_SINGLE_B` выше).
 * Проверяется то же по сути — что движение действительно происходит, — но
 * через `getAnimations()`.
 *
 * Три ловушки, на которых замер уже спотыкался; не переоткрывать их заново:
 *
 * 1. Положение пакета НЕЛЬЗЯ мерить `getBBox()`: он не учитывает
 *    трансформацию `offset-path` и возвращает одну и ту же коробку на всех
 *    кадрах. Мерится `getBoundingClientRect()` с переводом в единицы viewBox
 *    (`getBBox()` годится только для `<text>` — у подписей трансформации нет).
 * 2. Безголовый Chromium по умолчанию просит `prefers-reduced-motion: reduce`
 *    — то есть ЗАПАСНОЕ состояние и есть то, что видят тесты. Проверяя
 *    движение, контекст явно создаётся с `reducedMotion: 'no-preference'`.
 * 3. Перебор кадров идёт ОДНИМ `page.evaluate()`, а не двумястами: двести
 *    круговых рейсов в браузер — это минуты, и половина их уходит на
 *    сериализацию, а не на замер.
 *
 * Селектор ищет узел через атрибут `[data-case-flow]`, а не через `#cases`:
 * `#cases` — id секции главной (`Cases.astro`), рисунок сегодня там не
 * выводится вовсе; `data-case-flow` — собственный признак компонента,
 * не зависящий от того, на какой странице и в каком контейнере он стоит
 * (тот же приём, что уже применяет затвор цикла внутри самого компонента).
 */

const A = { layout: 'ra' as const, viewport: { width: 1440, height: 1000 }, viewBox: 608 };
const B = { layout: 'rb' as const, viewport: { width: 390, height: 900 }, viewBox: 320 };
const PERIOD_MS = 9000;

/** Ширины из таблицы раздела 2 брифа 07: раскрой, кегль подписи, влезает ли.
 *  Критерий проверяет ПОЛЕ (`.field`, паспарту `CaseIllustrationField.astro`
 *  главной) — панель разворота кейса несёт другой контейнер (`.frame`,
 *  `CaseSpread.astro`, без паспарту) с ДРУГИМ сторожем заполнения
 *  (`case-spread-fill.spec.ts`, раздел 10.1 брифа 12). Блок целиком спит в
 *  режиме `single="b"`, где `.field` физически нет. */
const FIELD_WIDTHS = [
  { width: 390, layout: 'rb', minLabelPx: 14.0 },
  { width: 760, layout: 'rb', minLabelPx: 14.0 },
  { width: 900, layout: 'rb', minLabelPx: 14.0 },
  { width: 1000, layout: 'rb', minLabelPx: 14.0 },
  { width: 1100, layout: 'rb', minLabelPx: 14.0 },
  { width: 1179, layout: 'rb', minLabelPx: 14.0 },
  { width: 1440, layout: 'ra', minLabelPx: 14.0 },
] as const;

/** Снимает раскрой «в поле»: габариты `<svg>`, внутреннее поле паспарту и
 *  минимальный кегль подписи на экране (кегль × фактический масштаб). */
async function measureField(page: Page, layout: string) {
  return page.evaluate((sel) => {
    const svg = document.querySelector(`[data-case-flow] svg.${sel}`) as SVGSVGElement | null;
    if (!svg) throw new Error(`нет [data-case-flow] svg.${sel}`);
    if (getComputedStyle(svg).display === 'none') throw new Error(`svg.${sel} скрыт на этой ширине`);
    const field = svg.closest('.field') as HTMLElement | null;
    if (!field) throw new Error('нет предка .field — этот критерий рассчитан на паспарту главной, не на панель разворота кейса');
    const fs = getComputedStyle(field);
    const fr = field.getBoundingClientRect();
    const inner = {
      w: fr.width - parseFloat(fs.paddingLeft) - parseFloat(fs.paddingRight)
        - parseFloat(fs.borderLeftWidth) - parseFloat(fs.borderRightWidth),
      h: fr.height - parseFloat(fs.paddingTop) - parseFloat(fs.paddingBottom)
        - parseFloat(fs.borderTopWidth) - parseFloat(fs.borderBottomWidth),
    };
    const sr = svg.getBoundingClientRect();
    const scale = sr.width / svg.viewBox.baseVal.width;
    const labelPx = [...svg.querySelectorAll('text')].map(
      (t) => parseFloat(getComputedStyle(t).fontSize) * scale,
    );
    return {
      svg: { w: sr.width, h: sr.height },
      inner,
      scale,
      minLabelPx: Math.min(...labelPx),
      labels: labelPx.length,
    };
  }, layout);
}

test.describe('«Заявка-Хаб» — раскрой в поле и кегль подписи (критерии 1 и 2)', () => {
  for (const w of FIELD_WIDTHS) {
    test(`${w.width} px: раскрой .${w.layout} целиком в поле, подпись не мельче 14 px`, async ({ page }) => {
      test.skip(IS_SINGLE_B, 'найденная страница держит рисунок в режиме single="b" (панель разворота кейса, .frame без паспарту) — критерий поля/паспарту главной сюда не относится, заполнение этой панели проверяет case-spread-fill.spec.ts');
      await page.setViewportSize({ width: w.width, height: 900 });
      await page.goto(ROUTE ?? '/');
      await page.locator(`[data-case-flow] svg.${w.layout}`).scrollIntoViewIfNeeded();
      const m = await measureField(page, w.layout);

      // Раскрой А несёт девять подписей (три источника раздельно), Б — семь
      // (источники слиты в одну строку через «·»).
      expect(m.labels, 'подписей в раскрое не нашлось').toBeGreaterThanOrEqual(7);
      expect(
        m.svg.w,
        `рисунок шире поля: ${m.svg.w.toFixed(1)} против ${m.inner.w.toFixed(1)}`,
      ).toBeLessThanOrEqual(m.inner.w + 0.5);
      expect(
        m.svg.h,
        `рисунок выше поля: ${m.svg.h.toFixed(1)} против ${m.inner.h.toFixed(1)} — ` +
          'ровно тот дефект, который чинил бриф (срез 194 px на 900…1179)',
      ).toBeLessThanOrEqual(m.inner.h + 0.5);
      expect(
        m.minLabelPx,
        `кегль подписи ${m.minLabelPx.toFixed(1)} px при масштабе ${m.scale.toFixed(3)}`,
      ).toBeGreaterThanOrEqual(w.minLabelPx);
    });
  }
});

test.describe('«Заявка-Хаб» — запасное состояние (критерий 5)', () => {
  /* Раскрой берётся тот, что физически есть на найденной странице: `.ra` в
   * режиме `single="b"` не рендерится вовсе (см. комментарий выше про
   * `IS_SINGLE_B`), и хардкодить его координаты значило бы проверять узел,
   * которого нет. Ожидаемое положение пакета читается не числом, вписанным
   * руками, а САМОЙ разметкой: покой — `--w13` (переменная на инлайновом
   * `style` кружка), и «кромка последнего узла канала» — последний
   * прямоугольник в `path.n` (тот же порядок, что уже использует `sweep()`
   * ниже для критерия 3/4/7). Это надёжнее, чем два раза переписывать
   * геометрию раскроя Б вручную (риск ошибиться в переносе — тот самый
   * долг, ради которого компонент сам не пишет числа маршрута руками). */
  const layout = IS_SINGLE_B ? B.layout : A.layout;
  const viewport = IS_SINGLE_B ? B.viewport : A.viewport;

  test(`reduce: схема нарисована целиком, пакет неподвижен на кромке узла последнего канала (раскрой .${layout})`, async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(ROUTE ?? '/');
    await page.locator(`[data-case-flow] svg.${layout}`).scrollIntoViewIfNeeded();

    const state = await page.evaluate((sel) => {
      const svg = document.querySelector(`[data-case-flow] svg.${sel}`) as SVGSVGElement;
      const pkt = svg.querySelector('.pkt') as SVGCircleElement;
      const line = svg.querySelector('path.d') as SVGPathElement;
      const sr = svg.getBoundingClientRect();
      const pr = pkt.getBoundingClientRect();
      const scale = sr.width / svg.viewBox.baseVal.width;
      const squares = (svg.querySelector('path.n') as SVGPathElement).getAttribute('d') || '';
      const rects = [...squares.matchAll(/M(\d+),(\d+)H(\d+)V(\d+)/g)].map((m) => ({
        x: +m[1], y: +m[2], w: +m[3] - +m[1], h: +m[4] - +m[2],
      }));
      const last = rects[rects.length - 1];
      return {
        dashoffset: getComputedStyle(line).strokeDashoffset,
        animations: pkt.getAnimations().length,
        offsetDistance: getComputedStyle(pkt).offsetDistance,
        w13: pkt.style.getPropertyValue('--w13').trim(),
        x: (pr.x + pr.width / 2 - sr.x) / scale,
        y: (pr.y + pr.height / 2 - sr.y) / scale,
        last,
      };
    }, layout);

    expect(state.dashoffset, 'линия схемы на нулевом кадре рисования при reduce').toBe('0px');
    expect(state.animations, 'при reduce у пакета не должно быть ни одной анимации').toBe(0);
    expect(state.offsetDistance, 'покой пакета обязан стоять на --w13, а не на анимационном значении').toBe(state.w13);
    // Покой — кромка последнего узла канала: центр пакета лежит на границе
    // его плашки (допуск — собственный радиус пакета, 4 единицы viewBox), не
    // внутри и не поодаль от неё.
    const onLeft = Math.abs(state.x - state.last.x) <= 4;
    const onRight = Math.abs(state.x - (state.last.x + state.last.w)) <= 4;
    const onTop = Math.abs(state.y - state.last.y) <= 4;
    const onBottom = Math.abs(state.y - (state.last.y + state.last.h)) <= 4;
    expect(
      onLeft || onRight || onTop || onBottom,
      `пакет (${state.x.toFixed(1)},${state.y.toFixed(1)}) не на кромке последнего узла ${JSON.stringify(state.last)}`,
    ).toBe(true);
    expect(errors, `консоль не пуста:\n${errors.join('\n')}`).toEqual([]);
    await context.close();
  });
});

/** Перебор кадров цикла одним заходом в браузер. Возвращает по кадру:
 *  положение центра пакета в единицах viewBox и его собственную `opacity`. */
async function sweep(page: Page, layout: string, frames: number) {
  return page.evaluate(
    async ({ sel, frames, period }) => {
      const svg = document.querySelector(`[data-case-flow] svg.${sel}`) as SVGSVGElement;
      const pkt = svg.querySelector('.pkt') as SVGCircleElement;
      const anims = pkt.getAnimations();
      if (anims.length !== 2) throw new Error(`у пакета ${anims.length} анимаций, ожидалось 2 (маршрут + видимость)`);
      anims.forEach((a) => a.pause());

      const vbw = svg.viewBox.baseVal.width;
      const out: { pct: number; x: number; y: number; op: number }[] = [];
      for (let i = 0; i < frames; i++) {
        const pct = (i / frames) * 100;
        anims.forEach((a) => { a.currentTime = (pct / 100) * period; });
        const sr = svg.getBoundingClientRect();
        const pr = pkt.getBoundingClientRect();
        const scale = sr.width / vbw;
        out.push({
          pct,
          x: (pr.x + pr.width / 2 - sr.x) / scale,
          y: (pr.y + pr.height / 2 - sr.y) / scale,
          op: Number(getComputedStyle(pkt).opacity),
        });
      }
      anims.forEach((a) => a.play());

      // Плашки — непрозрачные заливки `--bg`: под ними пакет закрыт законно.
      const nodeRect = svg.querySelector('rect.b') as SVGRectElement;
      const plates = [{
        x: nodeRect.x.baseVal.value,
        y: nodeRect.y.baseVal.value,
        w: nodeRect.width.baseVal.value,
        h: nodeRect.height.baseVal.value,
      }];
      const squares = (svg.querySelector('path.n') as SVGPathElement).getAttribute('d') || '';
      for (const m of squares.matchAll(/M(\d+),(\d+)H(\d+)V(\d+)/g)) {
        plates.push({ x: +m[1], y: +m[2], w: +m[3] - +m[1], h: +m[4] - +m[2] });
      }

      const texts = [...svg.querySelectorAll('text')].map((t) => {
        const b = (t as SVGTextElement).getBBox();
        return { label: t.textContent || '', x: b.x, y: b.y, w: b.width, h: b.height };
      });

      // Возврат — волосяная линия фазы 6, единственная в обоих раскроях.
      const ret = (svg.querySelector('path.h.p6') as SVGPathElement).getAttribute('d') || '';
      const poly = ret.split('M').filter(Boolean)[0];
      const first = poly.match(/^(\d+),(\d+)/)!;
      let cur = { x: +first[1], y: +first[2] };
      const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
      for (const m of poly.matchAll(/([HV])(\d+)/g)) {
        const next = m[1] === 'H' ? { x: +m[2], y: cur.y } : { x: cur.x, y: +m[2] };
        segments.push({ x1: cur.x, y1: cur.y, x2: next.x, y2: next.y });
        cur = next;
      }

      return { frames: out, plates, texts, segments };
    },
    { sel: layout, frames, period: PERIOD_MS },
  );
}

for (const cfg of [
  { name: 'А', ...A, pause: [55, 63], minClearance: 9 },
  { name: 'Б', ...B, pause: [65, 73], minClearance: 20 },
]) {
  test.describe(`«Заявка-Хаб» — раскрой ${cfg.name}: цикл движения`, () => {
    test(`пакет не перекрывает подпись, пауза единственная, возврат не режет подписи (критерии 3, 4, 7)`, async ({ browser }) => {
      // Раскрой А физически не рендерится в режиме single="b" (панель
      // разворота кейса) — см. `IS_SINGLE_B` выше. Тест не удалён и не
      // подогнан под несуществующий узел: он проснётся сам, если рисунок
      // однажды снова выведут в дуальном режиме.
      test.skip(cfg.name === 'А' && IS_SINGLE_B, 'раскрой .ra не рендерится в режиме single="b" — панель разворота кейса несёт только .rb (CaseFlowIllustration.astro, П-3 брифа 12)');

      const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: cfg.viewport });
      const page = await context.newPage();
      await page.goto(ROUTE ?? '/');
      await page.locator(`[data-case-flow] svg.${cfg.layout}`).scrollIntoViewIfNeeded();

      const FRAMES = 200;
      const { frames, plates, texts, segments } = await sweep(page, cfg.layout, FRAMES);

      // --- контроль самого инструмента: пакет обязан ЕХАТЬ -----------------
      const spread = Math.max(...frames.map((f) => f.x)) - Math.min(...frames.map((f) => f.x));
      expect(
        spread,
        'положение пакета одинаково на всех кадрах — значит замер снимает не то ' +
          '(ровно та ошибка, ради которой здесь `getBoundingClientRect`, а не `getBBox`)',
      ).toBeGreaterThan(100);

      // --- критерий 3: пакет не ложится на подпись --------------------------
      const inRect = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) =>
        x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
      const collisions = frames
        .filter((f) => f.op > 0.5)
        .filter((f) => texts.some((t) => inRect(f.x, f.y, t)) && !plates.some((p) => inRect(f.x, f.y, p)))
        .map((f) => `${f.pct.toFixed(1)}% (${f.x.toFixed(0)},${f.y.toFixed(0)})`);
      expect(collisions, `пакет виден поверх подписи на кадрах: ${collisions.join(', ')}`).toEqual([]);

      // --- критерий 7: неподвижность ровно одна и она на месте --------------
      const step = PERIOD_MS / FRAMES;
      const still: { from: number; to: number }[] = [];
      let run: { from: number; to: number } | null = null;
      for (let i = 1; i < frames.length; i++) {
        const a = frames[i - 1];
        const b = frames[i];
        const moved = Math.hypot(b.x - a.x, b.y - a.y) > 1;
        const visible = a.op > 0.5 && b.op > 0.5;
        if (!moved && visible) {
          run = run ? { from: run.from, to: b.pct } : { from: a.pct, to: b.pct };
        } else if (run) {
          still.push(run);
          run = null;
        }
      }
      if (run) still.push(run);
      const long = still.filter((r) => ((r.to - r.from) / 100) * 9 > 0.3);
      expect(
        long.map((r) => `${r.from.toFixed(1)}…${r.to.toFixed(1)}%`),
        'интервалов неподвижности видимого пакета должно быть ровно один',
      ).toHaveLength(1);
      expect(long[0].from, `пауза начинается на ${long[0].from}%`).toBeGreaterThanOrEqual(cfg.pause[0] - step / 90);
      expect(long[0].to, `пауза кончается на ${long[0].to}%`).toBeLessThanOrEqual(cfg.pause[1] + 1);
      const seconds = ((long[0].to - long[0].from) / 100) * 9;
      expect(seconds, `длительность паузы ${seconds.toFixed(2)} с`).toBeGreaterThan(0.72 - 0.05 - step / 1000);
      expect(seconds).toBeLessThan(0.72 + 0.05 + step / 1000);

      // --- критерий 4: линия возврата не пересекает подписи ------------------
      // Порог брифа назначен ВЕРТИКАЛЯМ (в А просветы вертикали x=496 до
      // «ТАБЛИЦЫ» и «TELEGRAM» не меньше 9 единиц, в Б у вертикали x=144 — не
      // меньше 20): именно вертикаль возврата шла сквозь подписи каналов и
      // была дефектом. Горизонтали проходят между строками, и их просветы
      // задуманы меньшими (шина возврата стоит в 11 единицах над своей
      // подписью в Б, замер брифа) — с них спрашивается только НЕПЕРЕСЕЧЕНИЕ.
      const clear = { vertical: Number.POSITIVE_INFINITY, horizontal: Number.POSITIVE_INFINITY };
      const where = { vertical: '', horizontal: '' };
      for (const s of segments) {
        const vertical = s.x1 === s.x2;
        const [lo, hi] = vertical ? [s.y1, s.y2] : [s.x1, s.x2];
        const [a, b] = [Math.min(lo, hi), Math.max(lo, hi)];
        for (const t of texts) {
          const kind = vertical ? 'vertical' : 'horizontal';
          let gap: number;
          if (vertical) {
            if (b < t.y || a > t.y + t.h) continue; // вертикаль не доходит до строки
            gap = s.x1 < t.x ? t.x - s.x1 : s.x1 > t.x + t.w ? s.x1 - (t.x + t.w) : -1;
          } else {
            if (b < t.x || a > t.x + t.w) continue;
            gap = s.y1 < t.y ? t.y - s.y1 : s.y1 > t.y + t.h ? s.y1 - (t.y + t.h) : -1;
          }
          if (gap < clear[kind]) {
            clear[kind] = gap;
            where[kind] = `${vertical ? `вертикаль x=${s.x1}` : `горизонталь y=${s.y1}`} ↔ «${t.label}»`;
          }
        }
      }
      expect(
        clear.vertical,
        `худший просвет вертикали возврата: ${clear.vertical.toFixed(1)} ед. — ${where.vertical}`,
      ).toBeGreaterThanOrEqual(cfg.minClearance);
      expect(
        clear.horizontal,
        `горизонталь возврата режет подпись: ${where.horizontal}`,
      ).toBeGreaterThan(0);

      await context.close();
    });
  });
}

test.describe('«Заявка-Хаб» — затвор цикла (критерий 6)', () => {
  /* Раскрой берётся тот, что физически есть на найденной странице — см.
   * `IS_SINGLE_B` выше; хардкодить `.ra` значило бы проверять узел, которого
   * в режиме `single="b"` не существует. */
  const layout = IS_SINGLE_B ? B.layout : A.layout;
  const viewport = IS_SINGLE_B ? B.viewport : A.viewport;

  test(`вне окна цикл стоит, в окне идёт (раскрой .${layout})`, async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'no-preference', viewport });
    const page = await context.newPage();
    await page.goto(ROUTE ?? '/');

    const readTime = () =>
      page.evaluate((sel) => {
        const pkt = document.querySelector(`[data-case-flow] svg.${sel} .pkt`) as SVGCircleElement;
        const t = pkt.getAnimations()[0]?.currentTime;
        return typeof t === 'number' ? t : Number(t ?? 0);
      }, layout);

    // Иллюстрация далеко внизу страницы — при загрузке она вне окна.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const off1 = await readTime();
    await page.waitForTimeout(1000);
    const off2 = await readTime();
    expect(
      off2 - off1,
      `вне окна цикл прирос на ${(off2 - off1).toFixed(0)} мс — затвор не сработал`,
    ).toBeLessThan(50);

    await page.locator(`[data-case-flow] svg.${layout}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const on1 = await readTime();
    await page.waitForTimeout(1000);
    const on2 = await readTime();
    expect(
      on2 - on1,
      `в окне цикл прирос всего на ${(on2 - on1).toFixed(0)} мс — движения нет`,
    ).toBeGreaterThan(800);

    await context.close();
  });
});

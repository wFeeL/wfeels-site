import { test, expect, type Page } from '@playwright/test';

/* Движение пакетов «Одной трубы» (кейс «Заявка-Хаб», бриф
 * `70-workshop/specs/site-v3/04-cases-brief.md`, раздел 5): заявки едут от
 * источников в узел и расходятся по каналам, ключевые кадры `translate` по
 * именованному таймлайну `--case-flow` (раздел 8.3 — ловушка `.flow`
 * `overflow-x: auto` перехватывает анонимный `view()`).
 *
 * Без именованного таймлайна (`view-timeline-name` на `.flow` +
 * `animation-timeline: --case-flow` на потомках) тест «no-preference —
 * пакет действительно едет» краснеет: `view()` у пакета разрешился бы
 * против `.flow` (сам прокручиваемый контейнер, вертикально не скроллится),
 * диапазон таймлайна свернулся бы в точку, и позиция пакета оставалась бы
 * одной и той же в любой точке прокрутки — ровно тот класс дефекта, который
 * здесь ищем, а не «анимации нет вовсе» (см. отчёт задачи, раздел
 * «Доказательство красноты»).
 *
 * Позиция пакета измеряется ОТНОСИТЕЛЬНО `svg.ra` (общего скролл-предка
 * пакета и самого узла отсчёта), а не абсолютными координатами вьюпорта:
 * `mouse.wheel` двигает всю страницу, и абсолютный `getBoundingClientRect()`
 * меняется от одной только прокрутки — разница с якорем гасит это и
 * оставляет только смещение от CSS `translate`.
 *
 * Headless Chromium по умолчанию отдаёт `prefers-reduced-motion: reduce` —
 * без явной эмуляции `no-preference` тест «движение действительно
 * происходит» проходил бы вхолостую. Раскрой А (`svg.ra`) — от 1180px,
 * поэтому ширина вьюпорта ниже выбрана заведомо шире порога. */

const WIDE = { width: 1440, height: 1000 };
// Пакет-повтор («Заявка-Хаб», раздел 5.4) — самый протяжённый маршрут
// (0→−256px по X, разворот на 64/40px по Y) — движение на нём заметнее
// любого другого пакета, замер устойчивее к суб-пиксельным допускам.
const RETRY_PKT = '#cases svg.ra .pkt.k-rt';
const ANCHOR = '#cases svg.ra';

async function relPos(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ({ pktSel, anchorSel }) => {
      const pkt = document.querySelector(pktSel) as SVGGraphicsElement | null;
      const anchor = document.querySelector(anchorSel) as SVGGraphicsElement | null;
      if (!pkt || !anchor) throw new Error(`не найден элемент: ${!pkt ? pktSel : anchorSel}`);
      const p = pkt.getBoundingClientRect();
      const a = anchor.getBoundingClientRect();
      return { x: p.x - a.x, y: p.y - a.y };
    },
    { pktSel: RETRY_PKT, anchorSel: ANCHOR },
  );
}

test.describe('«Заявка-Хаб» — пакеты едут по маршруту при прокрутке (`--case-flow`)', () => {
  test('prefers-reduced-motion: reduce — пакет неподвижен, схема нарисована целиком', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: WIDE });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/');

    await page.locator(RETRY_PKT).scrollIntoViewIfNeeded();
    const before = await relPos(page);

    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(50);
    const after = await relPos(page);

    expect(before.x, 'пакет сдвинулся по X при reduce — запасное состояние не статично').toBeCloseTo(after.x, 0);
    expect(before.y, 'пакет сдвинулся по Y при reduce — запасное состояние не статично').toBeCloseTo(after.y, 0);

    // Схема нарисована целиком: линии не на нулевом кадре (`stroke-dashoffset`
    // сброшен запасным состоянием, не анимацией).
    const line = page.locator('#cases svg.ra path.d').first();
    const dashoffset = await line.evaluate((el) => getComputedStyle(el).strokeDashoffset);
    expect(dashoffset, 'линия схемы на нулевом кадре рисования при reduce').toBe('0px');

    expect(errors, `консоль не пуста:\n${errors.join('\n')}`).toEqual([]);
    await context.close();
  });

  test('no-preference — пакет действительно едет: положение разное в нескольких точках прокрутки', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: WIDE });
    const page = await context.newPage();
    await page.goto('/');

    await page.locator(RETRY_PKT).scrollIntoViewIfNeeded();
    // Отступаем назад, чтобы застать иллюстрацию у ВХОДА в диапазон
    // (`entry 15%`), а не сразу в его середине.
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(50);

    const samples: { x: number; y: number }[] = [];
    for (let i = 0; i < 30; i++) {
      samples.push(await relPos(page));
      await page.mouse.wheel(0, 40);
      await page.waitForTimeout(20);
    }

    const xs = samples.map((s) => s.x);
    const ys = samples.map((s) => s.y);
    const spreadX = Math.max(...xs) - Math.min(...xs);
    const spreadY = Math.max(...ys) - Math.min(...ys);

    expect(
      spreadX > 2 || spreadY > 2,
      `пакет «повтор» не сдвинулся ни на градус прокрутки относительно ` +
        `svg.ra — X: ${JSON.stringify(xs)}, Y: ${JSON.stringify(ys)}. Значит именованный ` +
        'таймлайн разрешается не против окна (`.flow` перехватил `view()` — раздел 8.3 брифа).',
    ).toBe(true);

    // Пакет обязан осесть в покое (нативные `cx`/`cy` — точка доставки),
    // как только диапазон таймлайна пройден — та же дожимка малыми шагами,
    // что у иллюстрации «Замер» (`case-weight-motion.spec.ts`).
    let settled = false;
    let lastPos = samples[samples.length - 1];
    for (let i = 0; i < 60; i++) {
      await page.mouse.wheel(0, 60);
      await page.waitForTimeout(20);
      const pos = await relPos(page);
      if (Math.abs(pos.x - lastPos.x) < 0.5 && Math.abs(pos.y - lastPos.y) < 0.5) { settled = true; break; }
      lastPos = pos;
    }
    expect(settled, 'пакет «повтор» не осел в конечном положении после прохода диапазона').toBe(true);

    await context.close();
  });
});

import { test, expect, type Browser } from '@playwright/test';
import { readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* Сторож стоимости прокрутки для «шторки» фото в «Обо мне» (задача
 * «пролагивает при листании», 2026-08-21).
 *
 * ПРЕДЫСТОРИЯ. До этого захода часть 1 приёма («шторка» на загрузке) была
 * `clip-path`-анимацией на самом `.photo`. `clip-path` Chromium не
 * композитит НИ ПРИ КАКИХ условиях (проверено: ни `will-change: clip-path`,
 * ни снятие `round` из формы, ни `contain: paint` эффекта не дали) —
 * анимация перерисовывает фото на каждом кадре весь 1,1 с своей длительности,
 * а этот интервал (задержка 0,25 с + 1,1 с) почти всегда попадает на самое
 * начало жизни страницы — ровно туда, где реальный человек скорее всего и
 * начинает листать. В реальном браузере это стоило 42 пропущенных кадра из
 * 42 «карточных» (headed.mjs, 90 колёс, линия фона скрыта) — отключение
 * ТОЛЬКО этой анимации убирало пропуски до нуля.
 *
 * ЧТО МЕРИТ ТЕСТ. Не наличие свойства `clip-path` или `translate` в CSS
 * (в этом репозитории уже ловили четыре сторожа, которые мерили именно
 * так) — а ИТОГ: сколько раз Chromium реально перерисовал кадр (событие
 * трассировки `Paint`) за то же самое окно прокрутки, которым воспроизведён
 * баг. Число зависит от техники реализации, а не от имени свойства: если
 * приём когда-нибудь снова заменится на что-то paint-тяжёлое, тест
 * покраснеет независимо от того, как называется CSS-свойство.
 *
 * ПОЧЕМУ ЛИНИЯ ФОНА СКРЫТА. `BackgroundLine.astro` вне области этого захода
 * (см. задачу) и сама стоит десятки Paint-событий — без скрытия её шум
 * полностью маскирует сигнал шторки (проверено: без скрытия линии разница
 * между рабочим и старым приёмом на фоне общего Paint-счёта неразличима,
 * ~520 против ~522 из примерно 60 прокруток). Тот же приём изоляции требует
 * критерий приёмки задачи (`headed.mjs ... 'svg.line, footer svg.line {
 * display: none !important }'`).
 *
 * ПОРОГ. Калиброван прямым сравнением на этой же машине, тем же протоколом
 * (viewport 1728×1000, deviceScaleFactor 2, 60 тиков колеса по 16 мс,
 * линия скрыта): рабочий приём (`translate`-шторка) — 249 `Paint` дважды
 * подряд; временно возвращённый `clip-path`-приём — 374 и 375. Порог 320
 * лежит на равном удалении от обоих (±75 к рабочему, ±54 к сломанному) —
 * ближе к сломанному значению, чтобы не заворачивать тест дрожанием, но
 * гарантированно ловить возврат `clip-path`.
 *
 * СКОРОСТЬ. Тест поднимает отдельный Chromium (не тот, что держит основной
 * набор), включает CDP-трассировку и гоняет 60 синтетических тиков колеса —
 * секунд десять–пятнадцать вместо миллисекунд обычного e2e. Помечен
 * `test.slow()` (Playwright утраивает таймаут) и заголовком `@perf`, чтобы
 * при необходимости его можно было исключить `--grep-invert @perf` —
 * подробности порядка запуска в отчёте задачи. Тот же класс медленного
 * сторожа, что и `case-weight-load-time.spec.ts` (там — сеть, здесь —
 * трассировка), и по той же причине живёт в обычном наборе `test:e2e`, а не
 * в отдельном прогоне: без реального браузера и реальной прокрутки
 * результат ничего не доказывает (см. «Ловушка» в CLAUDE.md — `rAF` в
 * безголовом браузере лжёт, а счёт `Paint`/`RasterTask` из трассировки —
 * нет). */

const HIDE_LINE = 'svg.line, footer svg.line { display: none !important }';
const TRACE_CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline'];
const WHEEL_TICKS = 60;
const WHEEL_DELAY_MS = 16;

/** Порог калиброван в шапке файла: рабочий приём — 249, старый `clip-path` —
 *  374/375. 320 — с запасом от обоих сторон, ближе к сломанному значению. */
const MAX_PAINT_EVENTS = 320;

async function paintEventsDuringScroll(browser: Browser, baseURL: string): Promise<number> {
  const ctx = await browser.newContext({
    viewport: { width: 1728, height: 1000 },
    deviceScaleFactor: 2,
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(baseURL, { waitUntil: 'load' });
  // Линия фона — не в области этой задачи (см. шапку файла): скрыта, чтобы
  // не маскировать сигнал шторки, а не потому что она сама не в счёт.
  await page.addStyleTag({ content: HIDE_LINE });
  await page.evaluate(() => document.fonts.ready);
  // Задержка шторки — 0,25 с; ждём чуть меньше, чтобы окно трассировки
  // застало саму анимацию, а не только её хвост.
  await page.waitForTimeout(600);

  const out = join(tmpdir(), `about-photo-paint-${process.pid}-${Date.now()}.json`);
  await browser.startTracing(page, { path: out, categories: TRACE_CATEGORIES });
  for (let i = 0; i < WHEEL_TICKS; i++) {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel', x: 800, y: 500, deltaX: 0, deltaY: 120,
    });
    await new Promise((r) => setTimeout(r, WHEEL_DELAY_MS));
  }
  await page.waitForTimeout(900);
  await browser.stopTracing();

  const events = JSON.parse(readFileSync(out, 'utf8')).traceEvents as Array<
    { name: string; ph: string; dur?: number }
  >;
  unlinkSync(out);
  await ctx.close();

  return events.filter((e) => e.name === 'Paint' && e.ph === 'X' && e.dur).length;
}

test.describe('«Обо мне»: стоимость шторки при прокрутке @perf', () => {
  test('шторка не перерисовывает фото на каждом кадре прокрутки', async ({ browser, baseURL }) => {
    test.slow();
    const paintEvents = await paintEventsDuringScroll(browser, baseURL!);

    expect(
      paintEvents,
      `за 60 тиков колеса (линия фона скрыта) насчитано ${paintEvents} событий Paint — ` +
      `порог ${MAX_PAINT_EVENTS}. Похоже, шторка снова анимирует paint-тяжёлое свойство ` +
      '(например, вернулся `clip-path`) — см. диагноз в шапке файла и в `About.astro`.',
    ).toBeLessThan(MAX_PAINT_EVENTS);
  });
});

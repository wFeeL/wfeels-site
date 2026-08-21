import { test, expect, type Browser } from '@playwright/test';
import { readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/* Сторож стоимости прокрутки для линии на фоне (задача «пролагивает при
 * листании», D-080, `DECISIONS.md`, 2026-08-21) — по образцу
 * `about-photo-scroll-cost.spec.ts`, тот же приём изоляции и тот же тип
 * порога.
 *
 * ЧТО МЕРИТ ТЕСТ. Не наличие свойства `translate`/`stroke-dashoffset` в CSS
 * (свойство — заявленное намерение, не доказательство), а ИТОГ: сколько раз
 * Chromium реально перерисовал кадр (событие трассировки `Paint`) за то же
 * самое окно прокрутки, которым в `DECISIONS.md` (D-080) воспроизведена
 * жалоба «пролагивает». Число зависит от техники реализации `.line-curtain`,
 * а не от имени свойства.
 *
 * ИЗОЛЯЦИЯ. На странице ещё восемь элементов несут собственный
 * `animation-timeline: view()` (`Process`, `About`, `Faq`, `Pricing`, три
 * иллюстрации кейсов, `ThemeToggle`) — их Paint-события считались бы вместе
 * с линией и маскировали сигнал (тот же приём и та же причина, что у
 * `about-photo-scroll-cost.spec.ts`, где скрывалась линия ради сигнала
 * шторки фото — здесь наоборот, гасится всё, кроме линии).
 * `*:not(.line-curtain) { animation: none !important }` останавливает
 * анимацию везде, кроме шторки линии, ничего не трогая в разметке.
 *
 * ПОРОГ. Калиброван прямым A/B на этой же машине, тем же протоколом
 * (viewport 1400×900, 90 тиков колеса по 16 мс, боевая сборка, изоляция
 * выше): рабочий приём (первый проход D-080, `translate`-шторка) —
 * 561/562/579 событий `Paint` (три прогона); временно возвращённый
 * `stroke-dashoffset` (`git stash` на `BackgroundLine.astro`/`Section.astro`/
 * `Footer.astro`, коммит `4702039`, то есть механика ДО этой задачи) —
 * 928/928/928. Порог 750 лежит почти посередине (−189 от рабочего, +178 до
 * сломанного).
 *
 * ПРАВКА 2026-08-21 (второй проход D-080, тот же день): `.line-curtain`
 * теперь двигает не `translate`, а `transform: scaleY(...)` (причина —
 * пропущенные кадры в НАСТОЯЩЕМ браузере, не в этой трассировке `Paint`,
 * см. `BackgroundLine.astro`) — но обе техники одинаково композитные, ни
 * одна не перекрашивает `.line-curtain`, поэтому порог и калибровка A/B
 * выше остаются в силе без пересчёта; число событий `Paint` этот сторож
 * проверяет заново при каждом прогоне, а не сверяет со старым замером.
 * Замер headed.mjs того же дня (ниже) подтвердил это разделение буквально:
 * `scaleY` в изоляции (только шторка линии) даёт 9 пропущенных кадров из
 * 90 тиков — цель ≤10 выполнена; на полной странице (шторка плюс восемь
 * прочих `view()`-элементов) — 34, тот же порядок, что и абзац ниже уже
 * предсказывал ДО этой правки свойства.
 *
 * ЧЕГО ЭТОТ СТОРОЖ НЕ ДОКАЗЫВАЕТ. Прямой headed-замер (`headed.mjs`,
 * `DrawFrame`/`DroppedFrame`, отчёт задачи) на ЭТОЙ странице показал, что
 * реальные пропущенные кадры при полной прокрутке НЕ падают вместе с этим
 * числом — они определяются не тем, ЧТО анимирует `.line-curtain`
 * (paint-тяжёлое свойство или композитный `translate`), а тем, СКОЛЬКО
 * элементов одновременно держат `animation-timeline: view()` (при ≥10
 * активных таймлайнах разом главный поток форсирует `UpdateStyleAndLayout`
 * на каждом кадре независимо от анимируемого свойства — подтверждено
 * пошаговым отключением: 4 активных таймлайна линии рядом с восемью
 * прочими на странице → 0 пропусков в headed; 8 активных → те же ~40, что
 * и при всех 11 и что при `stroke-dashoffset`). Это ДРУГОЙ, более крупный
 * дефект архитектуры («сколько элементов разом на `view()`», а не «какое
 * свойство»), выходящий за рамки правки этой задачи (D-080 авторизовал
 * замену свойства, не переработку числа таймлайнов) — записан в отчёте
 * задачи для владельца отдельным пунктом. Этот сторож ловит РЕГРЕСС
 * paint-стоимости конкретно `.line-curtain` (тот дефект, который эта задача
 * действительно чинит), не общий бюджет пропущенных кадров страницы.
 *
 * СКОРОСТЬ. Отдельный Chromium, включённая CDP-трассировка, 90 тиков
 * колеса — секунды, не миллисекунды обычного e2e. `test.slow()` и
 * заголовок `@perf`, тот же класс сторожа, что `about-photo-scroll-cost.
 * spec.ts` и `case-weight-load-time.spec.ts` — исключается `--grep-invert
 * @perf`, если нужен быстрый прогон. */

const ISOLATE_OTHER_ANIMATIONS = '*:not(.line-curtain) { animation: none !important }';
const TRACE_CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline'];
const WHEEL_TICKS = 90;
const WHEEL_DELAY_MS = 16;

/** Порог калиброван в шапке файла: рабочий приём — 561/562/579, старый
 *  `stroke-dashoffset` — 928/928/928. 750 — почти посередине. */
const MAX_PAINT_EVENTS = 750;

async function paintEventsDuringScroll(browser: Browser, baseURL: string): Promise<number> {
  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await page.goto(baseURL, { waitUntil: 'load' });
  // Все анимации страницы, кроме шторки линии, — не в области этой задачи
  // (см. шапку файла): останавливаются, чтобы не маскировать сигнал линии,
  // а не потому что их вклад не в счёт.
  await page.addStyleTag({ content: ISOLATE_OTHER_ANIMATIONS });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);

  const out = join(tmpdir(), `background-line-paint-${process.pid}-${Date.now()}.json`);
  await browser.startTracing(page, { path: out, categories: TRACE_CATEGORIES });
  for (let i = 0; i < WHEEL_TICKS; i++) {
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseWheel', x: 700, y: 450, deltaX: 0, deltaY: 100,
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

test.describe('линия на фоне: стоимость шторки при прокрутке @perf', () => {
  test('шторка не перерисовывает путь на каждом кадре прокрутки', async ({ browser, baseURL }) => {
    test.slow();
    const paintEvents = await paintEventsDuringScroll(browser, baseURL!);

    expect(
      paintEvents,
      `за 90 тиков колеса (остальные анимации остановлены) насчитано ${paintEvents} ` +
      `событий Paint — порог ${MAX_PAINT_EVENTS}. Похоже, шторка снова анимирует ` +
      'paint-тяжёлое свойство (например, вернулся `stroke-dashoffset` на самом пути) ' +
      '— см. диагноз в шапке файла и в `BackgroundLine.astro`.',
    ).toBeLessThan(MAX_PAINT_EVENTS);
  });
});

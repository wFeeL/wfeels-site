import { test, expect, type Page } from '@playwright/test';
import { WEIGHT_ILLUSTRATION } from '../../data/case-illustrations';

/* Движение иллюстрации «Замер» (секция кейсов, блок «Этот сайт»), композиция
 * владельца 2026-08-19: стрелка по центру прорисовывается по мере прокрутки
 * (`animation-timeline`, именованный таймлайн `--weight-view`), четыре числа
 * отсчитываются от нуля до своих значений (инлайновый счётчик компонента).
 *
 * Запасное состояние — состояние ПО УМОЛЧАНИЮ: стрелка нарисована целиком,
 * все четыре числа стоят в конечных значениях. Headless Chromium по умолчанию
 * отдаёт `prefers-reduced-motion: reduce` — именно это и видит первый тест;
 * без явной эмуляции `no-preference` второй проходил бы вхолостую, проверяя
 * запасное состояние вместо движения. Эмуляция ниже явная, оба режима — своим
 * контекстом. */

const WIDE = { width: 1440, height: 1000 };
const ILLO = '[data-illustration="case-weight"]';
const CELLS = WEIGHT_ILLUSTRATION.cells;

/** Отношение нарисованной длины ствола к его раскладочной высоте: 0 — не
 *  начат, 1 — дорисован. Считается через `transform`, поэтому виден именно
 *  прогресс анимации, а не наличие элемента. */
async function shaftProgress(page: Page, seg: number): Promise<number> {
  return page.locator(`${ILLO} .arrow[data-seg="${seg}"] .shaft`).evaluate((el) => {
    const box = el.getBoundingClientRect();
    return (el as HTMLElement).offsetHeight === 0 ? 0 : box.height / (el as HTMLElement).offsetHeight;
  });
}

/** Тексты всех четырёх чисел в порядке разметки. */
async function printedValues(page: Page): Promise<string[]> {
  return Promise.all(
    CELLS.map((c) => page.locator(`${ILLO} [data-cell="${c.key}"] [data-count]`).innerText()),
  );
}

test.describe('иллюстрация «Замер» — стрелка и счёт по прокрутке', () => {
  test('prefers-reduced-motion: reduce — стрелка целая, все четыре числа в конечных значениях', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: WIDE });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto('/');

    await page.locator(ILLO).scrollIntoViewIfNeeded();

    for (const seg of [1, 2]) {
      expect(await shaftProgress(page, seg), `ствол стрелки ${seg} не дорисован при reduce`)
        .toBeCloseTo(1, 2);
      const head = await page.locator(`${ILLO} .arrow[data-seg="${seg}"] .head`).evaluate(
        (el) => el.getBoundingClientRect().width,
      );
      expect(head, `наконечник стрелки ${seg} не нарисован при reduce`).toBeGreaterThan(0);
    }

    // Отсчёт от нуля не имеет права оставить нули: при `reduce` счётчик вообще
    // не запускается, и на рисунке стоит ровно то, что уехало в сборку.
    expect((await printedValues(page)).map((s) => s.trim())).toEqual(CELLS.map((c) => c.value));

    expect(errors, `консоль не пуста:\n${errors.join('\n')}`).toEqual([]);
    await context.close();
  });

  test('no-preference — стрелка действительно рисуется, числа действительно считаются', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: WIDE });
    const page = await context.newPage();
    await page.goto('/');

    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    let sawShaftMidFlight = false;
    let sawCountMidFlight = false;

    for (let y = 0; y <= height && !(sawShaftMidFlight && sawCountMidFlight); y += 60) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' as ScrollBehavior }), y);
      const p = await shaftProgress(page, 1).catch(() => null);
      if (p !== null && p > 0.02 && p < 0.95) sawShaftMidFlight = true;
      const values = await printedValues(page).catch(() => null);
      if (values && values.some((v, i) => v.trim() !== CELLS[i].value)) sawCountMidFlight = true;
    }

    expect(sawShaftMidFlight, 'ствол стрелки ни разу не был замечен в полёте — значит анимация ' +
      'не применяется, а запасной тест проходит вхолостую').toBe(true);
    expect(sawCountMidFlight, 'ни одно число ни разу не отличалось от конечного — счётчик не ' +
      'работает (проверь, что скрипт инлайновый: поднимаемый сюда не доезжает)').toBe(true);

    /* Дожимаем прокруткой малыми шагами, пока стрелка не сойдётся. Диапазон
       движения (`cover 20%…66%`) — подмножество полной жизни таймлайна: как
       только субъект целиком уходит за пределы области прокрутки, таймлайн
       становится НЕАКТИВНЫМ, и действует значение свойства из того же блока
       (`transform: scaleY(0)`), а не последний прогресс. Поэтому конечное
       состояние проверяется, пока рисунок ещё виден, а не «где-нибудь ниже». */
    let done = 0;
    for (let i = 0; i < 80; i++) {
      done = await shaftProgress(page, 2);
      if (done > 0.99) break;
      await page.mouse.wheel(0, 60);
      await page.waitForTimeout(20);
    }
    expect(done, 'стрелка не дорисовалась до конца, пока рисунок ещё виден').toBeGreaterThan(0.99);

    // И числа обязаны прийти к своим значениям — ровно к напечатанным, без
    // «почти»: счётчик возвращает исходную строку, а не пересобранную.
    await expect
      .poll(async () => (await printedValues(page)).map((s) => s.trim()), { timeout: 5_000 })
      .toEqual(CELLS.map((c) => c.value));

    await context.close();
  });
});

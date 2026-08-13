import { test, expect } from '@playwright/test';

/* Движение полосы сравнения иллюстрации «Замер» (секция кейсов, блок «Этот
 * сайт»): полоса растёт от 0 до своей длины по прокрутке
 * (`animation-timeline: view()`), запасное состояние — полная длина сразу.
 *
 * Headless Chromium по умолчанию отдаёт `prefers-reduced-motion: reduce` —
 * без явной эмуляции `no-preference` тест «движение действительно
 * происходит» проходил бы вхолостую, проверяя запасное состояние вместо
 * анимации. Эмуляция ниже — явная, оба режима отдельным контекстом. */

const WIDE = { width: 1440, height: 1000 };
const FILL = '#cases .bar-row.ours .fill';

test.describe('иллюстрация «Замер» — рост полосы сравнения по прокрутке', () => {
  test('prefers-reduced-motion: reduce — полоса сразу полной длины, без прокрутки', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: WIDE });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/');

    const fill = page.locator(FILL);
    await fill.scrollIntoViewIfNeeded();
    const { widthPx, trackWidthPx, targetPct } = await fill.evaluate((el) => {
      const track = el.parentElement as HTMLElement;
      return {
        widthPx: el.getBoundingClientRect().width,
        trackWidthPx: track.getBoundingClientRect().width,
        targetPct: parseFloat(getComputedStyle(el).getPropertyValue('--target')),
      };
    });
    const expectedPx = (targetPct / 100) * trackWidthPx;
    // Допуск на суб-пиксельное округление браузера.
    expect(Math.abs(widthPx - expectedPx), `ширина ${widthPx}px, ожидалось ≈${expectedPx}px`)
      .toBeLessThan(2);
    expect(errors, `консоль не пуста:\n${errors.join('\n')}`).toEqual([]);
    await context.close();
  });

  test('no-preference — полоса действительно растёт: в проходе есть промежуточная ширина', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: WIDE });
    const page = await context.newPage();
    await page.goto('/');

    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    let sawMidFlight = false;

    for (let y = 0; y <= height; y += 80) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' as ScrollBehavior }), y);
      const widthPx = await page.locator(FILL).evaluate((el) => el.getBoundingClientRect().width).catch(() => null);
      if (widthPx !== null && widthPx > 0 && widthPx < 50) { sawMidFlight = true; break; }
    }

    expect(sawMidFlight, 'полоса «этот сайт» ни разу не была замечена в полёте — ' +
      'значит анимация не применяется, а запасной тест проходит вхолостую').toBe(true);

    // Полоса обязана осесть в конечной длине, пока элемент ЕЩЁ виден: диапазон
    // `entry 15% cover 65%` — подмножество полного времени жизни view-timeline
    // («cover» — вся видимая жизнь элемента, «65%» этой жизни может наступить
    // задолго до того, как элемент физически покинет кадр, если поле высокое).
    // Как только элемент целиком уходит за пределы области прокрутки, таймлайн
    // становится неактивным и действует значение свойства ИЗ ТОГО ЖЕ БЛОКА,
    // `width: 0`, а не последний прогресс — поэтому дожимаем прокруткой малыми
    // шагами, пока ширина не сойдётся к цели, вместо того чтобы гадать
    // положение по одной эвристике.
    const { trackWidthPx, targetPct } = await page.locator(FILL).evaluate((el) => {
      const track = el.parentElement as HTMLElement;
      return {
        trackWidthPx: track.getBoundingClientRect().width,
        targetPct: parseFloat(getComputedStyle(el).getPropertyValue('--target')),
      };
    });
    const expectedPx = (targetPct / 100) * trackWidthPx;

    let finalWidth = 0;
    for (let i = 0; i < 60; i++) {
      finalWidth = await page.locator(FILL).evaluate((el) => el.getBoundingClientRect().width);
      if (Math.abs(finalWidth - expectedPx) < 2) break;
      await page.mouse.wheel(0, 60);
      await page.waitForTimeout(20);
    }

    expect(Math.abs(finalWidth - expectedPx), `итоговая ширина ${finalWidth}px, ожидалось ≈${expectedPx}px`)
      .toBeLessThan(2);
    await context.close();
  });
});

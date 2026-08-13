import { test, expect } from '@playwright/test';

/* Дефект дизайн-ревью 2026-08-13, часть 1 (БЛОКЕР): на телефоне раскрывашка
 * «Меню» (`.nav-narrow`, `Header.astro`) вставала `position: absolute` в
 * правый угол — тот же угол, куда `.tools` (язык / тема / Telegram)
 * собирает свои органы через `justify-content: flex-end`. На 320…479 px
 * `.tools` умещается в одну строку без переноса, поэтому оба блока садились
 * друг на друга: `document.elementFromPoint` в центре ссылки Telegram
 * возвращал `SUMMARY`, а не саму ссылку — ссылка была на 100% площади
 * перекрыта и не нажималась пальцем ни на одной из пяти проверенных ширин.
 *
 * Порог `.nav-narrow { position: absolute }` — ровно `max-width: 479px`
 * (`Header.astro`); с 480px раскрывашка возвращается в обычный поток и
 * дефект исчезает сам, поэтому верхняя проверенная ширина — 479, а не 480. */

const WIDTHS = [320, 360, 390, 430, 479] as const;

test.describe('раскрывашка «Меню» не перекрывает Telegram на телефоне', () => {
  for (const width of WIDTHS) {
    test(`${width}px: центр ссылки Telegram отдаёт саму ссылку, не SUMMARY`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');

      const isTelegramHit = await page.evaluate(() => {
        const telegram = document.querySelector('.telegram');
        if (!telegram) return { ok: false, reason: 'a.telegram не найдена' };
        const box = telegram.getBoundingClientRect();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        return {
          ok: !!hit && !!hit.closest('.telegram'),
          tag: hit ? hit.tagName : null,
          cls: hit ? hit.className : null,
        };
      });

      expect(
        isTelegramHit.ok,
        `в центре ссылки Telegram на ${width}px оказался ` +
          `${isTelegramHit.tag}.${isTelegramHit.cls} — ссылка перекрыта и не нажимается`,
      ).toBe(true);
    });
  }

  test('открытая раскрывашка по-прежнему доступна и не съезжает за левый край', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/');

    const summary = page.locator('.nav-narrow summary');
    await summary.click();
    const nav = page.locator('.nav-narrow[open] nav');
    await expect(nav).toBeVisible();

    const box = await page.locator('.nav-narrow[open]').boundingBox();
    expect(box, 'открытая раскрывашка не отрисована').not.toBeNull();
    expect(box!.x, 'открытая раскрывашка не уезжает за левый край экрана').toBeGreaterThanOrEqual(0);
    expect(
      box!.x + box!.width,
      'открытая раскрывашка не уезжает за правый край экрана 320px',
    ).toBeLessThanOrEqual(320);
  });
});

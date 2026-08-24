import { test, expect } from '@playwright/test';

const PAGES = ['/privacy', '/terms', '/consent'];

for (const path of PAGES) {
  test(`${path} отдаётся и закрыт от индексации`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]'))
      .toHaveAttribute('content', 'noindex, nofollow');
  });

  test(`${path} опубликован как датированный документ`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('[data-draft-notice]')).toHaveCount(0);
    await expect(page.locator('main')).toContainText('24 августа 2026 года');
  });

  test(`${path} — заголовок раздела ближе к своему тексту, чем к чужому`,
    async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(path);

      // Единственная поверхность фундамента с настоящим объёмом текста. До
      // правки страницы рисовали h1/h2/p напрямую, а base.css ставит на
      // заголовки `margin: 0`: зазор над заголовком раздела и под ним был
      // одинаковый, и четырнадцать пар слипались в стену.
      const gaps = await page.evaluate(() => {
        const box = (el: Element) => el.getBoundingClientRect();
        const h1 = document.querySelector('main h1')!;
        const h2s = [...document.querySelectorAll('main h2')];
        const own = box(h2s[0].nextElementSibling!).top - box(h2s[0]).bottom;
        const afterTitle = box(h2s[0]).top - box(h1).bottom;
        const betweenSections =
          box(h2s[1]).top - box(h2s[1].previousElementSibling!).bottom;
        return { own, afterTitle, betweenSections };
      });

      expect(gaps.own, 'заголовок и его текст слиплись').toBeGreaterThan(8);
      expect(
        gaps.afterTitle,
        `первый раздел стоит вплотную под заголовком страницы: ${JSON.stringify(gaps)}`,
      ).toBeGreaterThan(gaps.own * 1.5);
      expect(
        gaps.betweenSections,
        `разделы не отбиты друг от друга: ${JSON.stringify(gaps)}`,
      ).toBeGreaterThan(gaps.own * 1.5);
    });

  test(`${path} — строка не тянется во всю ширину экрана`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(path);

    // Мера строки. Замер до правки: пометка черновика — 1100 px в одну строку.
    const widths = await page.evaluate(() =>
      [...document.querySelectorAll('main p')].map((el) => ({
        text: (el.textContent ?? '').slice(0, 40),
        width: el.getBoundingClientRect().width,
      })),
    );
    expect(widths.length).toBeGreaterThan(1);
    for (const { text, width } of widths) {
      expect(width, `строка «${text}…»`).toBeLessThanOrEqual(800);
    }
  });
}

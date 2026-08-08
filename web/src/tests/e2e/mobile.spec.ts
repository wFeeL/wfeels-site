import { test, expect } from '@playwright/test';

/** Минимум для цели нажатия пальцем. */
const TAP = 44;

test('на 320 px страница не прокручивается вбок', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});

test('на 375 px все органы управления в шапке пригодны для пальца',
  async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');

    const controls = page.locator(
      'header a.lang, header #theme-toggle, header .btn, header summary'
    );
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const box = await controls.nth(i).boundingBox();
      expect(box, `элемент ${i} не отрисован`).not.toBeNull();
      expect(box!.height, `высота элемента ${i}`).toBeGreaterThanOrEqual(TAP);
      expect(box!.width, `ширина элемента ${i}`).toBeGreaterThanOrEqual(TAP);
    }
  });

test('поля контейнера меняются на трёх ступенях', async ({ page }) => {
  const pad = () =>
    page.locator('main .container').first()
      .evaluate((el) => getComputedStyle(el).paddingLeft);

  await page.goto('/');

  await page.setViewportSize({ width: 375, height: 800 });
  expect(await pad()).toBe('16px');

  await page.setViewportSize({ width: 700, height: 900 });
  expect(await pad()).toBe('24px');

  await page.setViewportSize({ width: 1200, height: 900 });
  expect(await pad()).toBe('40px');
});

test('переключатель темы окрашен токенами, а не дефолтом браузера',
  async ({ page }) => {
    await page.goto('/');
    const btn = page.locator('#theme-toggle');
    const style = await btn.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, border: s.borderTopColor };
    });
    // Дефолтная кнопка в Chromium приезжает с непрозрачным серым фоном.
    expect(style.bg).toBe('rgba(0, 0, 0, 0)');
    expect(style.border).not.toBe('rgb(0, 0, 0)');
  });

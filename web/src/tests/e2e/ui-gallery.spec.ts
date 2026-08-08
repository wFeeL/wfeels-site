import { test, expect } from '@playwright/test';

test('витрина показывает все примитивы', async ({ page }) => {
  await page.goto('/dev/ui');
  for (const id of ['buttons', 'cards', 'metrics', 'fields', 'type', 'colors', 'prose']) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
});

test('витрина закрыта от индексации', async ({ page }) => {
  await page.goto('/dev/ui');
  await expect(page.locator('meta[name="robots"]'))
    .toHaveAttribute('content', 'noindex, nofollow');
});

test('темы дают разный фон и разный текст', async ({ page }) => {
  // body в base.css переходит между темами через `transition: background-color
  // var(--dur-micro)`. Запрос computed style сразу после смены data-theme попадает
  // в середину этого перехода и всегда возвращает стартовое значение — эмуляция
  // reduced-motion (уже уважается сайтом, см. base.css) и короткая пауза читают
  // итоговый, а не промежуточный цвет.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/dev/ui');

  const paint = async (theme: 'light' | 'dark') => {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    await page.waitForTimeout(50);
    return page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { bg: s.backgroundColor, fg: s.color };
    });
  };

  const light = await paint('light');
  const dark = await paint('dark');

  expect(light.bg).not.toBe(dark.bg);
  expect(light.fg).not.toBe(dark.fg);
  // Прежнее утверждение сохраняем: текст не должен слиться с фоном ни в одной теме.
  expect(light.bg).not.toBe(light.fg);
  expect(dark.bg).not.toBe(dark.fg);
});

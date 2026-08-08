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
  await page.goto('/dev/ui');

  const read = () =>
    page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { bg: s.backgroundColor, fg: s.color };
    });

  // body в base.css переходит между темами через `transition: background-color
  // var(--dur-micro)`. Запрос computed style сразу после смены data-theme вернёт
  // ещё СТАРТОВОЕ значение: часы перехода на этот момент показывают ноль, кадров
  // не было. Поэтому ждём не срок, а устоявшееся значение — два одинаковых чтения
  // подряд. Так тест не привязан ни к числу миллисекунд, ни к тому, отключена ли
  // анимация эмуляцией reduced-motion.
  const paint = async (theme: 'light' | 'dark') => {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);

    let prev: { bg: string; fg: string } | null = null;
    await expect
      .poll(async () => {
        const now = await read();
        const settled = prev !== null && now.bg === prev.bg && now.fg === prev.fg;
        prev = now;
        return settled;
      })
      .toBe(true);

    return read();
  };

  const light = await paint('light');
  const dark = await paint('dark');

  expect(light.bg).not.toBe(dark.bg);
  expect(light.fg).not.toBe(dark.fg);
  // Прежнее утверждение сохраняем: текст не должен слиться с фоном ни в одной теме.
  expect(light.bg).not.toBe(light.fg);
  expect(dark.bg).not.toBe(dark.fg);
});

import { test, expect } from '@playwright/test';

/* Дефект дизайн-ревью 2026-08-14 (САМОЕ ВАЖНОЕ): раскрывашка «Меню»
 * (`details.nav-narrow`, `Header.astro`) не закрывалась ничем, кроме
 * повторного тапа по заголовку. Замер ревью на 390px: после открытия
 * состояние `<details>` оставалось открытым при `Escape`, при тапе вне
 * панели и после прокрутки на 3000px — панель ехала вместе с липкой шапкой
 * поверх содержимого и на экране формы закрывала подпись и поле «Как вас
 * зовут».
 *
 * Три новых закрытия проверяются здесь: `Escape` (с возвратом фокуса на
 * кнопку меню), клик/тап вне панели, переход по своей же ссылке. Разметка
 * на `<details>` обязана продолжать работать без JS — этот файл не
 * отключает JavaScript ни в одном тесте (playwright не умеет выключать JS
 * избирательно для одной страницы удобно), но e2e для «работает и без
 * скрипта» — это `nav-narrow-tap.spec.ts` и обычный клик по summary,
 * который здесь тоже проверяется как открытие. */

async function openMenu(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const summary = page.locator('.nav-narrow summary');
  await summary.click();
  await expect(page.locator('.nav-narrow[open]')).toHaveCount(1);
  return summary;
}

test.describe('раскрывашка «Меню» закрывается тремя способами, помимо повторного тапа', () => {
  test('Escape закрывает меню и возвращает фокус на кнопку «Меню»', async ({ page }) => {
    const summary = await openMenu(page);

    await page.keyboard.press('Escape');

    await expect(page.locator('.nav-narrow[open]')).toHaveCount(0);
    await expect(summary).toBeFocused();
  });

  test('клик вне панели закрывает меню', async ({ page }) => {
    await openMenu(page);

    // Клик по точке заведомо вне раскрывашки (нижняя часть первого экрана).
    await page.mouse.click(20, 700);

    await expect(page.locator('.nav-narrow[open]')).toHaveCount(0);
  });

  test('переход по пункту меню закрывает панель', async ({ page }) => {
    await openMenu(page);

    const link = page.locator('.nav-narrow[open] nav a').first();
    await link.click();

    await expect(page.locator('.nav-narrow[open]')).toHaveCount(0);
  });

  test('без JS раскрывашка по-прежнему открывается и закрывается тапом по заголовку', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const summary = page.locator('.nav-narrow summary');
    await summary.click();
    await expect(page.locator('.nav-narrow[open]')).toHaveCount(1);

    await summary.click();
    await expect(page.locator('.nav-narrow[open]')).toHaveCount(0);
    await ctx.close();
  });
});

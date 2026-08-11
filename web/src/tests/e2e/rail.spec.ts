import { test, expect } from '@playwright/test';
import { HOME_SECTIONS } from '../../lib/sections';

/* Ширина берётся из общего списка точек перелома в tokens.css — 1100 px,
   рельс появляется на ней и выше. Проверяются оба края границы: 1099 (рельса
   ещё нет) и 1101 (полосы уже нет). Плана задача 4: «ни при каком размере не
   должно быть ни того ни другого». */
const WIDE = { width: 1280, height: 900 };

/* Секции задачи 2 — заглушки без утверждённого текста (задача 1 плана), и
   каждая заметно короче, чем понесёт настоящий контент задач 5–13. При
   высоте 900 px суммарная высота одиннадцати заглушек не даёт браузеру
   докрутить последние секции до верхней границы окна — `contact` и `faq`
   упираются в физический предел прокрутки в одной и той же позиции, и
   никакой алгоритм не отличит по чистому `scrollY` «докрутили до faq» от
   «докрутили до contact». Более низкое окно оставляет достаточно места для
   прокрутки, чтобы каждая секция стала различима, и не имеет отношения к
   самому рельсу — это свойство высоты страницы, а не его логики. */
const SPY_VIEWPORT = { width: 1280, height: 500 };

test.describe('рельс — точка перелома 1100 px (главная)', () => {
  test('на 1099 px рельса нет, полоса прогресса видна', async ({ page }) => {
    await page.setViewportSize({ width: 1099, height: 900 });
    await page.goto('/');
    await expect(page.locator('nav.rail')).toBeHidden();
    await expect(page.locator('#reading-progress')).toBeVisible();
  });

  test('на 1101 px рельс виден, полосы прогресса нет', async ({ page }) => {
    await page.setViewportSize({ width: 1101, height: 900 });
    await page.goto('/');
    await expect(page.locator('nav.rail')).toBeVisible();
    await expect(page.locator('#reading-progress')).toBeHidden();
  });

  // Другие страницы рельса не несут вовсе (`rail` не передан в `Base`) — на
  // них полоса видна при любой ширине, как до этой задачи.
  test('на посадочной без рельса полоса видна и на 1280 px', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/contact');
    await expect(page.locator('nav.rail')).toHaveCount(0);
    await expect(page.locator('#reading-progress')).toBeVisible();
  });
});

test.describe('рельс — роль и разметка', () => {
  test('рельс — навигация с подписанными точками', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');
    const nav = page.locator('nav.rail');
    await expect(nav).toHaveAttribute('aria-label', /.+/);
    const points = nav.locator('button.point');
    await expect(points).toHaveCount(7);
    for (const btn of await points.all()) {
      await expect(btn).toHaveAttribute('aria-label', /.+/);
    }
  });

  // Рельс лежит в разметке после `<main>` и после `<footer>` (`Base.astro`),
  // а не внутри `<main>`: DOM-порядок определяет таб-порядок при отсутствии
  // положительного `tabindex`, значит фокус клавиатуры идёт через содержимое
  // страницы и подвал раньше, чем доходит до точек рельса — рельс не
  // перехватывает его первым, хотя визуально стоит поверх контента.
  test('рельс в DOM-порядке идёт после main и подвала', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');
    const order = await page.evaluate(() => {
      const rail = document.querySelector('nav.rail');
      const main = document.querySelector('main');
      const footer = document.querySelector('footer');
      if (!rail || !main || !footer) return null;
      const after = (a: Element, b: Element) =>
        !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return after(main, rail) && after(footer, rail);
    });
    expect(order, 'рельс стоит раньше main или подвала в DOM').toBe(true);
  });
});

test.describe('рельс — подсветка активной точки по прокрутке', () => {
  for (const section of HOME_SECTIONS) {
    test(`секция «${section.id}» подсвечивает точку «${section.railLabel}»`,
      async ({ page }) => {
        await page.setViewportSize(SPY_VIEWPORT);
        await page.goto('/');
        // `scrollIntoViewIfNeeded` не делает ничего, если секция уже видна
        // целиком (заглушки задачи 2 короче окна) — прокрутка форсируется
        // явно, так же, как это делает клик по точке рельса.
        await page.evaluate((id) => {
          document.getElementById(id)?.scrollIntoView({ block: 'start' });
        }, section.id);

        await expect
          .poll(() => page.locator('.rail .point.active').count(), {
            message: `секция ${section.id}: ни одна точка не активна`,
          })
          .toBe(1);

        const active = page.locator('.rail .point.active');
        await expect(active).toHaveAttribute('aria-label', section.railLabel);
        await expect(active).toHaveAttribute('aria-current', 'true');
      });
  }
});

test.describe('рельс — клик по точке', () => {
  test('доводит прокрутку до первой секции точки', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');
    await page.locator('.rail .point[aria-label="ПРОЦЕСС"]').click();

    await expect
      .poll(() => page.evaluate(() => {
        const target = document.getElementById('process');
        return target ? Math.abs(window.scrollY - target.offsetTop) : null;
      }), { timeout: 3000 })
      .toBeLessThan(4);
  });

  test('при уменьшенном движении прокрутка всё равно доходит до цели',
    async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.setViewportSize(WIDE);
      await page.goto('/');
      await page.locator('.rail .point[aria-label="ОБО МНЕ"]').click();

      await expect
        .poll(() => page.evaluate(() => {
          const target = document.getElementById('about');
          return target ? Math.abs(window.scrollY - target.offsetTop) : null;
        }), { timeout: 3000 })
        .toBeLessThan(4);

      await ctx.close();
    });
});

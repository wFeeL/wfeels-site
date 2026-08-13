import { test, expect } from '@playwright/test';
import { TOP_CARDS, SHELF_CARDS } from '../../data/pricingShowcase';

/* Прицельные e2e секции 4 «Цены» — переработка по `70-workshop/specs/
 * site-v3/02-redesign-options.md`, «Принято владельцем», пункт 7: три
 * верхние карточки группы «Сайты» + компактная полка. Дублирует часть
 * проверок `dist-home-sections.test.ts` в РЕАЛЬНОМ браузере (раскладка,
 * видимость, высота секции), а не только в тексте `dist/index.html`. */

/* Появление карточек по прокрутке (02-card-motion.md) разводит тройку цен
 * каскадом «от центра наружу» в момент замера — тесты ниже проверяют
 * раскладку, а не движение. `reducedMotion: 'reduce'` даёт чистую раскладку
 * (бриф, раздел 12, ловушка 2). Допуски не ослабляются. */
test.use({ reducedMotion: 'reduce' });

test.describe('секция «Цены» — три верхние карточки', () => {
  test('desktop: три карточки видны, у рекомендуемой — ярлык «Самый популярный»', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#pricing');

    const section = page.locator('#pricing');
    await section.scrollIntoViewIfNeeded();

    for (const card of TOP_CARDS) {
      await expect(section.getByText(card.showcaseName, { exact: true })).toBeVisible();
      await expect(section.getByText(card.price, { exact: false }).first()).toBeVisible();
    }

    await expect(section.getByText('Самый популярный')).toBeVisible();
    // Ровно одна карточка несёт ярлык.
    await expect(section.getByText('Самый популярный')).toHaveCount(1);
  });

  /* Правка владельца 2026-08-13, второй заход, часть 6: рекомендуемая
   * карточка стоит чуть выше соседей (`transform: translateY(-12px)` на
   * `.card--accent`, `Pricing.astro`) — три карточки больше НЕ в одну строку
   * по Y буквально. Тест проверяет то же намерение другим допуском: две
   * обычные карточки по-прежнему стоят вровень друг с другом, а рекомендуемая
   * — заметно (но не запредельно) выше обеих. */
  test('desktop: обычные карточки стоят в ряд, рекомендуемая — выше них', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#pricing');
    const cards = page.locator('#pricing .top-grid > a, #pricing .top-grid > div');
    const count = await cards.count();
    expect(count).toBe(3);
    const boxes = await Promise.all(
      Array.from({ length: count }, (_, i) => cards.nth(i).boundingBox()),
    );
    const recommendedIndex = TOP_CARDS.findIndex((c) => c.recommended);
    expect(recommendedIndex).toBeGreaterThanOrEqual(0);

    const others = boxes.filter((_, i) => i !== recommendedIndex).map((b) => b!.y);
    expect(Math.max(...others) - Math.min(...others), 'обычные карточки стоят не вровень друг с другом').toBeLessThan(4);

    const recommendedTop = boxes[recommendedIndex]!.y;
    const lift = Math.min(...others) - recommendedTop;
    expect(lift, 'рекомендуемая карточка должна стоять заметно выше соседей').toBeGreaterThan(4);
    expect(lift, 'рекомендуемая карточка не должна уезжать слишком высоко').toBeLessThan(40);
  });

  test('mobile: карточки видны, полка видна, страница не скроллится вбок', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/#pricing');
    const section = page.locator('#pricing');
    await section.scrollIntoViewIfNeeded();

    for (const card of TOP_CARDS) {
      await expect(section.getByText(card.showcaseName, { exact: true })).toBeVisible();
    }
    for (const card of SHELF_CARDS) {
      await expect(section.getByText(card.label, { exact: true })).toBeVisible();
    }

    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth - el.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('полка: ссылки ведут на ожидаемые посадочные (пока 404 до спеки 03 — важна сама разметка href)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#pricing');
    const section = page.locator('#pricing');

    for (const card of SHELF_CARDS) {
      const link = section.locator(`a[href="${card.href}"]`);
      await expect(link).toHaveCount(1);
    }
  });

  test('в секции нет ни одной метки спроса, кроме разрешённой «Самый популярный» (отмена D-029 владельцем 2026-08-13, часть 2)', async ({ page }) => {
    await page.goto('/#pricing');
    const section = page.locator('#pricing');
    // Разрешённая строка вырезается ПЕРЕД проверкой стема «популярн» — иначе
    // легитимный ярлык красил бы этот тест сам на себе.
    const text = (await section.innerText()).toLowerCase().split('самый популярный').join('');
    for (const word of ['хит продаж', 'популярн', 'выбор клиентов', 'чаще всего заказывают']) {
      expect(text, `метка спроса «${word}»`).not.toContain(word);
    }
  });

  test('prefers-reduced-motion: секция рендерится без ошибок консоли', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#pricing');
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await expect(page.locator('#pricing')).toBeVisible();

    expect(errors, `консольные ошибки: ${errors.join(' | ')}`).toHaveLength(0);
  });
});

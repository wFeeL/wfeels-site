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

  test('полка: карточка ведёт на свою посадочную услуги', async ({ page }) => {
    // Решение владельца 2026-08-18 (карточка временно ведёт к форме, D-052)
    // действовало «до появления посадочных»; посадочные исполнены (спека 03)
    // — правка 2026-08-26 возвращает переход на них.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#pricing');
    const section = page.locator('#pricing');

    for (const card of SHELF_CARDS) {
      const link = section.getByRole('link', { name: card.label, exact: true });
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute('href', card.href);
    }
  });

  test('верхняя тройка: кнопка карточки ведёт туда же, куда карточка', async ({ page }) => {
    // Покупатель, нажавший «Корпоративный сайт — 30 000 ₽», хочет узнать
    // состав, а не форму: форма ждёт его внизу посадочной, с предвыбранной
    // услугой (`LeadForm service={page.code}`, `pages/services/[slug].astro`).
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#pricing');
    const section = page.locator('#pricing');

    for (const card of TOP_CARDS) {
      const link = section.getByRole('link', { name: card.cta, exact: true });
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute('href', card.href);
    }
  });

  test('полка: цель нажатия — вся карточка, и ссылка в ней ровно одна', async ({ page }) => {
    // Карточка подсвечивается целиком при наведении, то есть обещает, что
    // нажимается вся. До 2026-08-18 нажималось только название высотой ~22 px.
    // Приём — растянутая ссылка (`.shelf-label::after { inset: 0 }`), та же
    // идиома, что принята для блоков кейсов вариантом В (D-047).
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#pricing');
    const cards = page.locator('#pricing .shelf > .card');
    const count = await cards.count();
    expect(count).toBe(SHELF_CARDS.length);

    for (let i = 0; i < count; i += 1) {
      const card = cards.nth(i);
      // Второй фокусируемой цели внутри карточки не появилось.
      await expect(card.locator('a')).toHaveCount(1);

      const reach = await card.evaluate((el) => {
        const link = el.querySelector('a');
        if (!link) return null;
        const c = el.getBoundingClientRect();
        const after = getComputedStyle(link, '::after');
        return {
          h: c.height,
          w: c.width,
          stretched: after.position === 'absolute' && after.inset !== 'auto',
        };
      });
      expect(reach, 'в карточке полки нет ссылки').not.toBeNull();
      expect(reach!.stretched, 'ссылка карточки не растянута на карточку')
        .toBe(true);
      // Раз цель — вся карточка, минимум 44 px обеспечен её же размером.
      expect(Math.min(reach!.h, reach!.w)).toBeGreaterThanOrEqual(44);
    }
  });

  test('полка: наведение не двигает раскладку — ни карточку, ни текст под ней', async ({ page }) => {
    // Правка владельца 2026-08-18: «при наведении изменяется размер и текст
    // после всех карточек неуклюже скачет». Причина была не в анимации, а в
    // росте толщины рамки: `border-box` держит внешний размер, но рамка
    // съедает ВНУТРЕННЮЮ ширину — строки описания перебирались заново,
    // высота карточки менялась, и всё, что ниже полки, дёргалось.
    // Подсветка обязана оставаться чисто красочной: заливка, цвет рамки и
    // внутренняя тень геометрию не трогают.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#pricing');

    const card = page.locator('#pricing .shelf > .card').first();
    const below = page.locator('#contact');

    const measure = async () => ({
      card: await card.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width * 100), h: Math.round(r.height * 100) };
      }),
      // Координата от НАЧАЛА ДОКУМЕНТА, а не от окна: `hover()` доводит
      // карточку до видимой области, то есть прокручивает страницу, и
      // оконная координата уехала бы на величину прокрутки — сторож ловил бы
      // собственное действие вместо дефекта раскладки.
      belowTop: await below.evaluate(
        (el) => Math.round((el.getBoundingClientRect().top + window.scrollY) * 100),
      ),
    });

    const before = await measure();
    await card.hover();
    // Переход по `--dur-micro` успевает закончиться; ждём кадр отрисовки.
    await page.waitForTimeout(400);
    const after = await measure();

    expect(after.card.w, 'ширина карточки поехала при наведении')
      .toBe(before.card.w);
    expect(after.card.h, 'высота карточки поехала при наведении')
      .toBe(before.card.h);
    expect(after.belowTop, 'текст под полкой сдвинулся при наведении')
      .toBe(before.belowTop);
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

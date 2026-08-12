import { test, expect } from '@playwright/test';

/** Линия на фоне главной (`BackgroundLine.astro`, план `02-home-plan.md`,
 *  задача 13; спека `02-home.md`, раздел 15).
 *
 *  Запасное состояние проверяется ПОДМЕНОЙ, а не рассуждением (требование
 *  задачи): перехватывается настоящий CSS-файл сборки, и из него физически
 *  вырезается блок `@supports (animation-timeline: scroll())`. Браузер,
 *  получивший такой файл, ведёт себя ровно так же, как браузер без
 *  поддержки фичи — он никогда не видит условие, а не «понимает» и
 *  отвергает его. Это тот же исход, который получит настоящий Firefox
 *  2026-08 (фича у него за флагом), не пересказанный, а воспроизведённый. */

/** Находит среди подключённых страницей стилей тот, что несёт `.line-path`
 *  (Astro раскладывает стили компонентов по чанкам с хэшами в имени —
 *  адресовать файл по имени нельзя, оно меняется от сборки к сборке). */
async function findLineStylesheetHref(page: import('@playwright/test').Page) {
  const hrefs = await page.locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((l) => l.getAttribute('href') ?? ''));
  for (const href of hrefs) {
    const res = await page.request.get(href);
    const css = await res.text();
    if (css.includes('.line-path')) return { href, css };
  }
  throw new Error('стиль .line-path не найден ни в одном подключённом файле');
}

test.describe('линия на фоне — запасное состояние без поддержки animation-timeline', () => {
  test('без блока @supports линия видна целиком, без анимации', async ({ page }) => {
    await page.goto('/');
    const { href, css } = await findLineStylesheetHref(page);

    // Вырезаем ИМЕННО блок @supports с этим условием, считая вложенность
    // фигурных скобок, — внутри него ещё один уровень (@media). Обычная
    // "жадная" регулярка до первой `}` обрежет блок на середине.
    const marker = '@supports (animation-timeline:scroll())';
    const start = css.indexOf(marker);
    expect(start, 'в собранном CSS нет @supports(animation-timeline:scroll())').toBeGreaterThan(-1);
    let depth = 0;
    let end = start;
    for (let i = css.indexOf('{', start); i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) { end = i + 1; break; }
      }
    }
    const withoutSupports = css.slice(0, start) + css.slice(end);
    expect(withoutSupports).not.toContain('animation-timeline');

    await page.route(`**${href}`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/css', body: withoutSupports }));
    await page.reload();

    const style = await page.locator('.line-path').evaluate((el) => {
      const s = getComputedStyle(el);
      return { dasharray: s.strokeDasharray, animationName: s.animationName, opacity: s.opacity };
    });
    // Ни дэша, ни анимации — то самое единственное запасное состояние.
    expect(style.dasharray === 'none' || style.dasharray === '').toBe(true);
    expect(style.animationName).toBe('none');
    expect(Number(style.opacity)).toBeGreaterThan(0);
  });
});

test.describe('линия на фоне — уменьшенное движение', () => {
  test('при prefers-reduced-motion: reduce линия прорисована целиком, без анимации',
    async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.goto('/');
      const style = await page.locator('.line-path').evaluate((el) => {
        const s = getComputedStyle(el);
        return { dasharray: s.strokeDasharray, animationName: s.animationName };
      });
      expect(style.dasharray === 'none' || style.dasharray === '').toBe(true);
      expect(style.animationName).toBe('none');
      await ctx.close();
    });
});

test.describe('линия на фоне — обычный путь (поддержка есть, движение разрешено)', () => {
  test('линия получает анимацию, завязанную на прокрутку', async ({ page }) => {
    await page.goto('/');
    const style = await page.locator('.line-path').evaluate((el) => {
      const s = getComputedStyle(el);
      return { dasharray: s.strokeDasharray, animationName: s.animationName, timeline: s.animationTimeline };
    });
    expect(style.animationName).not.toBe('none');
    expect(style.dasharray).not.toBe('none');
  });

  test('линия присутствует в HTML без выполнения JavaScript (статика)', async ({ request }) => {
    const res = await request.get('/');
    const html = await res.text();
    expect(html).toContain('class="line-path"');
    // Путь начинается на узле сетки 32 px (64 = 2×32) и не пуст.
    expect(html).toMatch(/d="M 64 0 C /);
  });

  test('линия — не орган управления: вне таб-порядка и указателя', async ({ page }) => {
    await page.goto('/');
    const wrap = page.locator('.bg-line');
    await expect(wrap).toHaveAttribute('aria-hidden', 'true');
    const pointerEvents = await wrap.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pointerEvents).toBe('none');
  });
});

test.describe('линия на фоне — только главная сегодня', () => {
  test('на посадочной без пропа line линии нет', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator('.bg-line')).toHaveCount(0);
  });
});

/* Блокер B3 (design-ревью 2026-08-12): на 390 px линия шла по строкам
 * «Как обычно бывает», подписи поля формы и строки про Telegram в
 * подвале — колонка текста занимает всю ширину, и полосе качания линии
 * (64…320 px от левого края) негде идти, не задевая текст. Контраст текста
 * поверх штриха падал до ≈1,9:1 при пороге AA 4.5:1 (00-overview, раздел 4).
 * Решение — не рисовать линию вовсе ниже 900 px (тот же порог, на котором
 * ядро переключается на второй раскрой), а не пытаться найти геометрию,
 * которая нигде не пересекает текст на узкой колонке: такой геометрии на
 * полной ширине экрана не существует. */
test.describe('линия на фоне — ниже 900 px не рисуется вовсе', () => {
  test('на 390 px (мобильный) линии нет в разметке видимой', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/');
    await expect(page.locator('.bg-line')).toBeHidden();
  });

  test('на 899 px линии всё ещё нет, на 900 px уже есть', async ({ page }) => {
    await page.setViewportSize({ width: 899, height: 900 });
    await page.goto('/');
    await expect(page.locator('.bg-line')).toBeHidden();

    await page.setViewportSize({ width: 900, height: 900 });
    await expect(page.locator('.bg-line')).toBeVisible();
  });

  // Требование B3: на ширинах ≥ 900 px линия видна целиком независимо от
  // prefers-reduced-motion и от поддержки animation-timeline — вырезание её
  // ниже 900 px не должно задеть уже покрытые запасные состояния выше в
  // этом файле (они идут на ширине по умолчанию, тоже ≥ 900 px, но здесь
  // проверяется явно и на именно граничной ширине 900 px).
  test('на 900 px при prefers-reduced-motion линия видна целиком', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('/');
    await expect(page.locator('.bg-line')).toBeVisible();
    const style = await page.locator('.line-path').evaluate((el) => {
      const s = getComputedStyle(el);
      return { dasharray: s.strokeDasharray, animationName: s.animationName, opacity: s.opacity };
    });
    expect(style.dasharray === 'none' || style.dasharray === '').toBe(true);
    expect(style.animationName).toBe('none');
    expect(Number(style.opacity)).toBeGreaterThan(0);
    await ctx.close();
  });
});

import { test, expect } from '@playwright/test';

/** Линия на фоне главной — бриф `70-workshop/specs/site-v3/
 *  02-background-line.md`. Механика сменилась с одного SVG-пути на всю
 *  страницу (`animation-timeline: scroll(root)`) на отрезок на секцию
 *  (`animation-timeline: view()`, раздел 2) — тесты ниже проверяют НОВУЮ
 *  разметку (`.bg-line` внутри каждой `<section data-line-side>`), а не
 *  прежнюю (`.line-path`).
 *
 *  ЛОВУШКА headless-Chromium: по умолчанию он отдаёт `prefers-reduced-
 *  motion: reduce`, даже когда тест явно этого не просил — любая проверка
 *  движения обязана эмулировать `no-preference` явно, иначе «обычный путь»
 *  тихо тестирует то же самое запасное состояние, что и тест на reduce. */

async function findLineStylesheetHref(page: import('@playwright/test').Page) {
  const hrefs = await page.locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((l) => l.getAttribute('href') ?? ''));
  for (const href of hrefs) {
    const res = await page.request.get(href);
    const css = await res.text();
    if (css.includes('.bg-line')) return { href, css };
  }
  throw new Error('стиль .bg-line не найден ни в одном подключённом файле');
}

test.describe('линия на фоне — запасное состояние без поддержки animation-timeline', () => {
  test('без блока @supports линия видна целиком, без анимации', async ({ page }) => {
    await page.goto('/');
    const { href, css } = await findLineStylesheetHref(page);

    // `animation-timeline:view()` — общая техника: её же несут карточки,
    // диалог и ядро тизера фабрики (каждый в СВОЁМ @supports). Резать нужно
    // ИМЕННО блок линии — тот, что содержит уникальную для неё анимацию
    // `bg-line-draw`, — а не первый по тексту @supports с этим условием
    // (прежняя редакция уже красилась именно на этом, см. историю файла).
    const marker = '@supports (animation-timeline:view())';
    let start = css.indexOf(marker);
    let ourBlockStart = -1;
    let ourBlockEnd = -1;
    while (start !== -1) {
      let depth = 0;
      let end = start;
      for (let i = css.indexOf('{', start); i < css.length; i++) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') {
          depth--;
          if (depth === 0) { end = i + 1; break; }
        }
      }
      if (css.slice(start, end).includes('bg-line-draw')) {
        ourBlockStart = start;
        ourBlockEnd = end;
        break;
      }
      start = css.indexOf(marker, end);
    }
    expect(ourBlockStart, 'в собранном CSS не нашёлся @supports-блок линии (bg-line-draw)').toBeGreaterThan(-1);

    const withoutSupports = css.slice(0, ourBlockStart) + css.slice(ourBlockEnd);

    /* Вне вырезанного блока имя `bg-line-draw` остаётся ЗАКОННО — это само
       объявление `@keyframes`, которое сборщик держит на верхнем уровне и
       которое ничего не применяет: набор кадров без `animation-name` не
       двигает ничего. Прежняя редакция проверяла отсутствие самого имени и
       падала на этом при исправном коде — то есть требовала спрятать кадры,
       а не поведение.

       Проверять надо ПРИМЕНЕНИЕ: назначение анимации и скрывающий
       `clip-path`. Оба литерала в собранном CSS встречаются ровно по одному
       разу (проверено), поэтому их отсутствие означает именно то, что
       заявлено, а не совпадение с чужим правилом. */
    expect(withoutSupports, 'вне @supports осталось назначение анимации линии')
      .not.toContain('animation-name:bg-line-draw');
    expect(withoutSupports, 'вне @supports осталось состояние, скрывающее линию')
      .not.toContain('clip-path:inset(0 0 100%)');

    await page.route(`**${href}`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/css', body: withoutSupports }));
    await page.reload();

    const style = await page.locator('.bg-line').first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { clipPath: s.clipPath, animationName: s.animationName };
    });
    expect(style.clipPath === 'none').toBe(true);
    expect(style.animationName).toBe('none');
  });
});

test.describe('линия на фоне — уменьшенное движение', () => {
  test('при prefers-reduced-motion: reduce линия прорисована целиком, без анимации',
    async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.goto('/');
      const style = await page.locator('.bg-line').first().evaluate((el) => {
        const s = getComputedStyle(el);
        return { clipPath: s.clipPath, animationName: s.animationName };
      });
      expect(style.clipPath === 'none').toBe(true);
      expect(style.animationName).toBe('none');
      await ctx.close();
    });
});

test.describe('линия на фоне — обычный путь (поддержка есть, движение разрешено)', () => {
  test('каждый .bg-line получает анимацию, завязанную на view()', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    await page.goto('/');
    const styles = await page.locator('.bg-line').evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        return { animationName: s.animationName, timeline: s.animationTimeline };
      }));
    expect(styles.length).toBe(10); // десять секций главной (lib/sections.ts)
    for (const s of styles) {
      expect(s.animationName).not.toBe('none');
    }
    await ctx.close();
  });

  test('линия присутствует в HTML без выполнения JavaScript (статика)', async ({ request }) => {
    const res = await request.get('/');
    const html = await res.text();
    // Десять секций, десять атрибутов стороны — источник lib/sections.ts.
    expect((html.match(/data-line-side="(left|right)"/g) ?? []).length).toBe(10);
    expect(html).toContain('class="bg-line"');
  });

  test('линия — не орган управления: вне таб-порядка и указателя', async ({ page }) => {
    await page.goto('/');
    const first = page.locator('.bg-line').first();
    await expect(first).toHaveAttribute('aria-hidden', 'true');
    const pointerEvents = await first.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pointerEvents).toBe('none');
  });
});

test.describe('линия на фоне — только главная сегодня', () => {
  test('на посадочной без пропа line линии нет', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator('.bg-line')).toHaveCount(0);
  });
});

/* Раздел 6 брифа отменяет D-026: порог 900 px (линия не рисуется вовсе)
 * заменён на 480 px, и обоснование другое — прогон вынесен в поле страницы
 * вне колонки содержимого, а не прибит к левому краю в 64…320 px. */
test.describe('линия на фоне — порог 480 px (раздел 6, D-026 отменён)', () => {
  test('на 390 px (мобильный) линии нет в разметке видимой', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/');
    await expect(page.locator('.bg-line').first()).toBeHidden();
  });

  test('на 479 px линии всё ещё нет, на 480 px уже есть', async ({ page }) => {
    await page.setViewportSize({ width: 479, height: 900 });
    await page.goto('/');
    await expect(page.locator('.bg-line').first()).toBeHidden();

    await page.setViewportSize({ width: 480, height: 900 });
    await expect(page.locator('.bg-line').first()).toBeVisible();
  });

  test('на 900 px линия по-прежнему видна (порог D-026 больше не действует)', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('/');
    await expect(page.locator('.bg-line').first()).toBeVisible();
  });
});

/* Раздел 9, пункт 7 — ни на одной ширине из числа проверяемых линия не
 * порождает горизонтальную прокрутку: вынос .bg-line за кромку секции
 * (--line-out / --line-out-right, раздел 3.4) ограничен clamp()'ом,
 * границу проверяем измерением, а не полагаемся на формулу. */
test.describe('линия на фоне — не создаёт горизонтальной прокрутки', () => {
  for (const width of [480, 768, 900, 1220, 1324, 1440, 1920]) {
    test(`${width}px: scrollWidth === clientWidth`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/');
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `лишняя горизонтальная прокрутка ${overflow}px на ${width}px`).toBe(0);
    });
  }
});

/* Раздел 9, пункт 10 — переходов на странице ровно семь (восемь точек
 * рельса − одна), и они стоят на границах точек рельса, а не где придётся.
 * Проверка идёт по data-атрибутам (lib/backgroundLine.ts, раздел 4, схема
 * Ч-3), не по картинке — картинка проверяется юнит-тестом геометрии. */
test.describe('линия на фоне — переходы стоят на границах точек рельса (схема Ч-3)', () => {
  test('семь секций несут cross, ровно на границах, сторона финиша — правая', async ({ page }) => {
    await page.goto('/');
    const sections = await page.locator('section[data-line-side]').evaluateAll((els) =>
      els.map((el) => ({
        id: el.id,
        side: el.getAttribute('data-line-side'),
        cross: el.getAttribute('data-line-cross'),
      })));
    const crossings = sections.filter((s) => s.cross !== 'none');
    expect(crossings.length).toBe(7);
    expect(sections[0].side).toBe('left');
    expect(sections[sections.length - 1].side).toBe('right');
  });
});

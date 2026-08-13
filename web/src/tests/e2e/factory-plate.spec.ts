import { test, expect } from '@playwright/test';

/** Плита в тизере фабрики — бриф `70-workshop/specs/site-v3/02-home-core.md`
 *  (вариант владельца А «Плита»), критерии приёмки 9–12.
 *
 *  ЛОВУШКА headless-Chromium: по умолчанию он отдаёт
 *  `prefers-reduced-motion: reduce`, даже когда тест явно этого не просил —
 *  любая проверка движения обязана эмулировать `no-preference` явно, иначе
 *  «обычный путь» тихо тестирует то же самое запасное состояние, что и тест
 *  на reduce (ловушка, уже пойманная в `background-line.spec.ts`). */

async function findPlateStylesheet(page: import('@playwright/test').Page) {
  const hrefs = await page.locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((l) => l.getAttribute('href') ?? ''));
  for (const href of hrefs) {
    const res = await page.request.get(href);
    const css = await res.text();
    if (css.includes('fp-frame-in')) return { href, css };
  }
  throw new Error('стиль fp-frame-in не найден ни в одном подключённом файле');
}

/** Вырезает блок `@supports (animation-timeline:view())…{…}`, который несёт
 *  анимацию плиты (содержит `fp-frame-in`) — тот же приём, что в
 *  `background-line.spec.ts`: резать нужно ИМЕННО блок плиты, а не первый по
 *  тексту `@supports` с тем же условием (в файле их несколько: карточки,
 *  диалог, линия фона, плита — у каждого свой `@supports`). */
function cutSupportsBlock(css: string, marker: string): string {
  const needle = '@supports (animation-timeline:view())';
  let start = css.indexOf(needle);
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
    if (css.slice(start, end).includes(marker)) {
      return css.slice(0, start) + css.slice(end);
    }
    start = css.indexOf(needle, end);
  }
  throw new Error(`@supports-блок с «${marker}» не найден`);
}

async function plateStates(page: import('@playwright/test').Page) {
  const frame = await page.locator('.fp-frame').evaluate((el) => {
    const s = getComputedStyle(el);
    return { opacity: s.opacity, clipPath: s.clipPath, animationName: s.animationName };
  });
  const types = await page.locator('.fp-type').evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el);
      return { opacity: Number(s.opacity), translate: s.translate, animationName: s.animationName };
    }));
  const legVisible = await page.locator('.fp-legs i').first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { opacity: Number(s.opacity), animationName: s.animationName };
  });
  const runningAnimations = await page.locator('.factory-plate').evaluate(
    (el) => el.getAnimations({ subtree: true }).length,
  );
  return { frame, types, legVisible, runningAnimations };
}

test.describe('плита фабрики — запасное состояние (критерий 10)', () => {
  test('prefers-reduced-motion: reduce — рисунок виден целиком, анимаций нет', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.locator('.factory-plate').scrollIntoViewIfNeeded();

    const { frame, types, legVisible, runningAnimations } = await plateStates(page);

    expect(frame.clipPath === 'none' || /^inset\(0px(?: 0px){0,3}\)$/.test(frame.clipPath)).toBe(true);
    expect(frame.animationName).toBe('none');

    for (const t of types) {
      expect(t.opacity).toBeGreaterThanOrEqual(0.99);
      expect(t.translate === 'none' || t.translate === '0px 0px').toBe(true);
      expect(t.animationName).toBe('none');
    }

    expect(legVisible.opacity).toBeGreaterThanOrEqual(0.99);
    expect(legVisible.animationName).toBe('none');
    expect(runningAnimations).toBe(0);
    await ctx.close();
  });

  test('без блока @supports (animation-timeline) — тот же результат', async ({ page }) => {
    await page.goto('/');
    const { href, css } = await findPlateStylesheet(page);
    const withoutSupports = cutSupportsBlock(css, 'fp-frame-in');

    expect(withoutSupports, 'вне @supports осталось назначение анимации плиты')
      .not.toContain('animation-name:fp-frame-in');

    await page.route(`**${href}`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/css', body: withoutSupports }));
    await page.reload();
    await page.locator('.factory-plate').scrollIntoViewIfNeeded();

    const { frame, types, runningAnimations } = await plateStates(page);
    expect(frame.clipPath === 'none' || /^inset\(0px(?: 0px){0,3}\)$/.test(frame.clipPath)).toBe(true);
    for (const t of types) expect(t.opacity).toBeGreaterThanOrEqual(0.99);
    expect(runningAnimations).toBe(0);
  });
});

test.describe('плита фабрики — раскрой 1440/1100 (критерий 11)', () => {
  for (const [width, expectedPanel] of [[1440, 1034], [1100, 954]] as const) {
    test(`${width}px: плита занимает всю ширину панели, четыре равные колонки, без переполнения`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/');
      const plate = page.locator('.factory-plate');
      await plate.scrollIntoViewIfNeeded();

      const plateWidth = await plate.evaluate((el) => el.getBoundingClientRect().width);
      expect(Math.abs(plateWidth - expectedPanel), `плита ${plateWidth}px, ожидалось ~${expectedPanel}px`)
        .toBeLessThanOrEqual(1);

      const colWidths = await page.locator('.fp-type').evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().width));
      for (let i = 1; i < colWidths.length; i++) {
        expect(Math.abs(colWidths[i] - colWidths[0])).toBeLessThanOrEqual(1);
      }

      const overflowing = await page.locator('.fp-type, .fp-cells li').evaluateAll((els) =>
        els.filter((el) => el.scrollWidth > el.clientWidth + 1).length);
      expect(overflowing, 'текст выходит за рамку своей колонки').toBe(0);

      const horizontalScroll = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(horizontalScroll).toBe(0);
    });
  }
});

test.describe('плита фабрики — раскрой 390 (критерий 12)', () => {
  test('390px: плита не шире 308px, высота не больше 560px, без переполнений', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/');
    const plate = page.locator('.factory-plate');
    await plate.scrollIntoViewIfNeeded();

    const box = await plate.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
    expect(box.width).toBeLessThanOrEqual(308);
    expect(box.height).toBeLessThanOrEqual(560);

    const visibleLegs = await page.locator('.fp-legs i').evaluateAll((els) =>
      els.filter((el) => getComputedStyle(el).display !== 'none').length);
    expect(visibleLegs, 'ниже 900px должна остаться ровно одна видимая ножка').toBe(1);

    const overflowing = await page.locator('.factory-plate *').evaluateAll((els) =>
      els.filter((el) => el.scrollWidth > el.clientWidth + 1).length);
    expect(overflowing, 'переполнение внутри плиты на 390px').toBe(0);
  });
});

import { test, expect, type Page } from '@playwright/test';

const DESKTOP = { width: 1440, height: 900 };

async function settleAt(page: Page, y: number): Promise<void> {
  await page.evaluate((scrollY) => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, scrollY);
  }, y);
  await page.evaluate(() => new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve)),
  ));
}

async function lineHeadPx(page: Page): Promise<number> {
  return page.evaluate(() => {
    const probe = document.createElement('i');
    probe.style.cssText = 'position:fixed;top:var(--line-head);visibility:hidden';
    document.body.appendChild(probe);
    const top = probe.getBoundingClientRect().top;
    probe.remove();
    return top;
  });
}

test.describe('линия-рассказчик — непрерывность и финал', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${colorScheme}: подвал прозрачен и продолжает линию`, async ({ browser }) => {
      const context = await browser.newContext({
        colorScheme,
        reducedMotion: 'reduce',
        viewport: DESKTOP,
      });
      const page = await context.newPage();
      await page.goto('/');

      const footer = await page.locator('footer').evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          background: style.backgroundColor,
          zIndex: style.zIndex,
          line: !!el.querySelector('.line'),
          curtain: !!el.querySelector('.line-curtain-local'),
        };
      });
      expect(footer.background).toBe('rgba(0, 0, 0, 0)');
      expect(footer.zIndex).toBe('auto');
      expect(footer.line).toBe(true);
      expect(footer.curtain).toBe(true);
      await context.close();
    });
  }
});

async function heroFill(page: Page): Promise<{
  fraction: number;
  animationCount: number;
  labelAnimationCount: number;
  labelOffset: number;
  timing: string;
  fillMode: string;
}> {
  return page.locator('#hero .cta .cta-ignite-fill').evaluate((el) => {
    const style = getComputedStyle(el);
    const wrap = el.closest('.cta-primary-wrap') as HTMLElement;
    const label = el.querySelector('.cta-ignite-label') as HTMLElement;
    const fillRect = el.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const visibleWidth = Math.max(0, Math.min(fillRect.right, wrapRect.right) - wrapRect.left);
    return {
      fraction: visibleWidth / wrapRect.width,
      animationCount: el.getAnimations().length,
      labelAnimationCount: label.getAnimations().length,
      labelOffset: Math.abs(labelRect.left - wrapRect.left),
      timing: style.animationTimingFunction,
      fillMode: style.animationFillMode,
    };
  });
}

test.describe('CTA первого экрана — одно плавное заполнение', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`${colorScheme}: заполнение проходит промежуточные состояния и обращается назад`, async ({ browser }) => {
      const context = await browser.newContext({
        colorScheme,
        reducedMotion: 'no-preference',
        viewport: DESKTOP,
      });
      const page = await context.newPage();
      await page.goto('/');
      await page.waitForTimeout(1600);

      await settleAt(page, 0);
      expect((await heroFill(page)).fraction).toBeCloseTo(0, 2);

      let middle: { y: number; fraction: number } | null = null;
      for (let y = 0; y <= 260; y += 4) {
        await settleAt(page, y);
        const state = await heroFill(page);
        if (state.fraction > 0.2 && state.fraction < 0.8) {
          middle = { y, fraction: state.fraction };
          break;
        }
      }
      expect(middle, 'не найден кадр с частично заполненной кнопкой').not.toBeNull();
      const middleState = await heroFill(page);
      expect(middleState.labelOffset, 'белая подпись едет вместе с заливкой').toBeLessThan(0.5);

      await settleAt(page, 260);
      const filled = await heroFill(page);
      expect(filled.fraction).toBeCloseTo(1, 2);
      expect(filled.animationCount).toBe(1);
      expect(filled.labelAnimationCount).toBe(1);
      expect(filled.labelOffset).toBeLessThan(0.5);
      expect(filled.timing).toBe('cubic-bezier(0.65, 0, 0.35, 1)');
      expect(filled.fillMode).toBe('both');

      const realButton = await page.locator('#hero .cta .btn.primary').evaluate((el) => ({
        animations: el.getAnimations().length,
        background: getComputedStyle(el).backgroundColor,
      }));
      expect(realButton.animations).toBe(0);

      await settleAt(page, 0);
      expect((await heroFill(page)).fraction).toBeCloseTo(0, 2);
      await context.close();
    });
  }

  test('reduce и ширина <900px сразу показывают обычную акцентную кнопку без анимации', async ({ browser }) => {
    for (const options of [
      { reducedMotion: 'reduce' as const, viewport: DESKTOP },
      { reducedMotion: 'no-preference' as const, viewport: { width: 480, height: 900 } },
    ]) {
      const context = await browser.newContext(options);
      const page = await context.newPage();
      await page.goto('/');
      const state = await page.evaluate(() => {
        const button = document.querySelector('#hero .cta .btn.primary') as HTMLElement;
        const fill = document.querySelector('#hero .cta .cta-ignite-fill') as HTMLElement;
        return {
          buttonBackground: getComputedStyle(button).backgroundColor,
          accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
          fillOpacity: getComputedStyle(fill).opacity,
          fillAnimations: fill.getAnimations().length,
        };
      });
      expect(state.fillOpacity).toBe('0');
      expect(state.fillAnimations).toBe(0);
      expect(state.buttonBackground).not.toBe('rgba(0, 0, 0, 0)');
      await context.close();
    }
  });
});

test.describe('линия пересекает рекомендуемую карточку цен', () => {
  test('вход и выход проходят через разные кромки, внутри остаётся длинный отрезок', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');

    const result = await page.evaluate(() => {
      const card = document.querySelector('#pricing .top-grid > .recommended-card');
      const path = document.querySelector('#pricing svg.line path:not(.line-branch)') as SVGPathElement | null;
      const svg = path?.closest('svg') as SVGSVGElement | null;
      if (!card || !path || !svg) return null;

      const box = card.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const sx = svgRect.width / vb.width;
      const sy = svgRect.height / vb.height;
      const total = path.getTotalLength();
      const samples: Array<{ x: number; y: number; inside: boolean }> = [];
      for (let length = 0; length <= total; length += 1) {
        const point = path.getPointAtLength(length);
        const x = svgRect.left + (point.x - vb.x) * sx;
        const y = svgRect.top + (point.y - vb.y) * sy;
        samples.push({ x, y, inside: x >= box.left && x <= box.right && y >= box.top && y <= box.bottom });
      }
      const first = samples.findIndex((sample) => sample.inside);
      let last = -1;
      for (let i = samples.length - 1; i >= 0; i -= 1) {
        if (samples[i].inside) { last = i; break; }
      }
      if (first < 0 || last < 0) return { inside: false as const };

      let insidePx = 0;
      for (let i = first; i < last; i += 1) {
        insidePx += Math.hypot(samples[i + 1].x - samples[i].x, samples[i + 1].y - samples[i].y);
      }
      const side = (point: { x: number; y: number }) =>
        (Object.entries({
          left: Math.abs(point.x - box.left),
          right: Math.abs(point.x - box.right),
          top: Math.abs(point.y - box.top),
          bottom: Math.abs(point.y - box.bottom),
        }) as Array<[string, number]>).sort((a, b) => a[1] - b[1])[0][0];
      return {
        inside: true as const,
        insidePx,
        entry: side(samples[first]),
        exit: side(samples[last]),
      };
    });

    expect(result).not.toBeNull();
    expect(result!.inside).toBe(true);
    if (!result!.inside) return;
    expect(result!.entry).not.toBe(result!.exit);
    expect(result!.insidePx).toBeGreaterThanOrEqual(240);
  });

  test('старой line-outline нет, рекомендацию несут surface и badge', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    const card = page.locator('#pricing .recommended-card');
    await expect(card.locator('.line-outline')).toHaveCount(0);
    await expect(card.locator('.recommendation-surface')).toHaveCount(1);
    await expect(card.locator('.badge')).toHaveCount(1);
  });
});

async function digitColor(page: Page, index: number, y: number): Promise<string> {
  await settleAt(page, y);
  return page.locator('#process .num').nth(index).evaluate((el) => getComputedStyle(el).color);
}

test.describe('цифры процесса — плавное изменение собственного цвета', () => {
  test('пять диапазонов начинаются у нижних кромок и не создают второго глифа', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: DESKTOP });
    const page = await context.newPage();
    await page.goto('/');
    const head = await lineHeadPx(page);
    const numbers = page.locator('#process .num');
    await expect(numbers).toHaveCount(5);

    const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const accent = await digitColor(page, 0, maxScroll);
    const muted = await digitColor(page, 0, 0);
    expect(accent).not.toBe(muted);

    const starts: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      const docBottom = await numbers.nth(index).evaluate((el) => el.getBoundingClientRect().bottom + scrollY);
      const expected = Math.round(docBottom - head);
      const before = await digitColor(page, index, expected - 12);
      const middle = await digitColor(page, index, expected + 64);
      const after = await digitColor(page, index, expected + 144);
      expect(before, `цифра ${index + 1}: цвет появился раньше линии`).toBe(muted);
      expect(middle, `цифра ${index + 1}: нет промежуточного цвета`).not.toBe(muted);
      expect(middle, `цифра ${index + 1}: переход закончился скачком`).not.toBe(accent);
      expect(after, `цифра ${index + 1}: переход не завершился`).toBe(accent);
      starts.push(expected);
      expect(await numbers.nth(index).evaluate((el) => getComputedStyle(el, '::after').content)).toBe('none');
    }
    for (let i = 1; i < starts.length; i += 1) {
      expect(starts[i]).toBeGreaterThan(starts[i - 1]);
    }

    await settleAt(page, maxScroll);
    const down = await numbers.evaluateAll((els) => els.map((el) => getComputedStyle(el).color));
    expect(new Set(down)).toEqual(new Set([accent]));
    await settleAt(page, 0);
    const up = await numbers.evaluateAll((els) => els.map((el) => getComputedStyle(el).color));
    expect(new Set(up)).toEqual(new Set([muted]));
    await settleAt(page, maxScroll);
    const downAgain = await numbers.evaluateAll((els) => els.map((el) => getComputedStyle(el).color));
    expect(new Set(downAgain)).toEqual(new Set([accent]));
    await context.close();
  });

  test('после плавного диапазона цвет не мигает', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    const number = page.locator('#process .num').first();
    const bottom = await number.evaluate((el) => el.getBoundingClientRect().bottom + scrollY);
    await settleAt(page, Math.round(bottom - await lineHeadPx(page) + 144));
    const samples: string[] = [];
    for (let i = 0; i < 8; i += 1) {
      await page.waitForTimeout(40);
      samples.push(await number.evaluate((el) => getComputedStyle(el).color));
    }
    expect(new Set(samples).size).toBe(1);
  });

  test('reduce, печать и ширина <900px не оставляют цифры серыми', async ({ browser }) => {
    for (const options of [
      { reducedMotion: 'reduce' as const, viewport: DESKTOP },
      { reducedMotion: 'no-preference' as const, viewport: { width: 768, height: 900 } },
    ]) {
      const context = await browser.newContext(options);
      const page = await context.newPage();
      await page.goto('/');
      const colors = await page.locator('#process .num').evaluateAll((els) => els.map((el) => getComputedStyle(el).color));
      expect(new Set(colors).size).toBe(1);
      const animations = await page.locator('#process .num').evaluateAll((els) => els.reduce((sum, el) => sum + el.getAnimations().length, 0));
      expect(animations).toBe(0);
      await context.close();
    }
  });

  test('отводов к цифрам нет, а реальные номера скрыты от повторного объявления', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/');
    await expect(page.locator('#process svg.line path')).toHaveCount(1);
    await expect(page.locator('#process .line-branch')).toHaveCount(0);
    await expect(page.locator('#process .num[aria-hidden="true"]')).toHaveCount(5);
  });
});

test('точечные события линии не заводят scroll-JS или data-защёлки', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).not.toContain('IntersectionObserver');
  expect(html).not.toContain('data-line-lit');
  expect(html).not.toContain('data-line-drawn');
  expect(html).not.toContain('data-lit');
});

import { expect, test } from '@playwright/test';

test.describe('выбранные deco-фичи', () => {
  test('Ф-4: RU и EN сохраняют фразу и оборачивают каждое слово', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    for (const path of ['/', '/en']) {
      await page.goto(path);
      const ink = page.locator('.closing.ink');
      await expect(ink).toHaveCount(1);
      const state = await ink.evaluate((paragraph) => {
        const words = [...paragraph.querySelectorAll('i')];
        return {
          text: paragraph.textContent,
          joined: words.map((word) => word.textContent).join(' '),
          count: words.length,
          opacities: words.map((word) => getComputedStyle(word).opacity),
        };
      });
      expect(state.count).toBeGreaterThan(5);
      expect(state.joined).toBe(state.text);
      expect(new Set(state.opacities)).toEqual(new Set(['1']));
    }
    await context.close();
  });

  test('Ф-7: первый экран движется только при no-preference', async ({ browser }) => {
    const selectors = [
      '#hero > .t-label', '#hero h1', '#hero .t-body-lg',
      '#hero .offer > li:nth-child(1)', '#hero .offer > li:nth-child(2)',
      '#hero .offer > li:nth-child(3)', '#hero .offer > li:nth-child(4)',
      '#hero .cta', '#hero .regalia',
    ];
    for (const reducedMotion of ['reduce', 'no-preference'] as const) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 }, reducedMotion,
      });
      const page = await context.newPage();
      await page.goto('/');
      const states = await page.evaluate((items) => items.map((selector) => {
        const element = document.querySelector(selector)!;
        const style = getComputedStyle(element);
        return { opacity: style.opacity, name: style.animationName };
      }), selectors);
      if (reducedMotion === 'reduce') {
        expect(states.every((state) => state.opacity === '1' && state.name === 'none')).toBe(true);
      } else {
        expect(states.filter((state) => state.name === 'hero-draw')).toHaveLength(selectors.length);
        await page.waitForTimeout(1000);
        for (const selector of selectors) await expect(page.locator(selector)).toHaveCSS('opacity', '1');
      }
      await context.close();
    }
  });

  test('Ф-8: междокументный переход работает, а reduced motion его отключает', async ({ browser }) => {
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 }, reducedMotion,
      });
      const page = await context.newPage();
      await page.addInitScript(() => {
        (window as unknown as { __viewTransition?: boolean }).__viewTransition = false;
        window.addEventListener('pagereveal', (event) => {
          (window as unknown as { __viewTransition?: boolean }).__viewTransition =
            (event as unknown as { viewTransition?: unknown }).viewTransition != null;
        }, { once: true });
      });
      await page.goto('/');
      await page.locator('#contact a[href="/consent"]').first().click();
      await page.waitForURL('**/consent');
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() =>
        (window as unknown as { __viewTransition?: boolean }).__viewTransition))
        .toBe(reducedMotion === 'no-preference');
      await context.close();
    }
  });

  test('Ф-9: семь микровзаимодействий присутствуют в вычисленных стилях', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const card = page.locator('.card').first();
    expect(await card.evaluate((element) => getComputedStyle(element, '::before').backgroundImage))
      .not.toBe('none');
    await card.hover();
    await expect.poll(() => card.evaluate((element) => getComputedStyle(element, '::after').opacity))
      .toBe('1');

    const serviceLink = page.locator('#services .links a').first();
    await serviceLink.hover();
    await expect.poll(() => serviceLink.locator('span').evaluate((element) =>
      getComputedStyle(element).translate)).toContain('4px');

    const textarea = page.locator('#contact textarea');
    const field = await textarea.evaluate((element) => {
      const style = getComputedStyle(element);
      return { sizing: style.getPropertyValue('field-sizing'), maxHeight: style.maxHeight };
    });
    expect(field.sizing).toBe('content');
    expect(field.maxHeight).toBe('540px');

    const alwaysUnderlined = page.locator('#contact .consent a').first();
    const underline = await alwaysUnderlined.evaluate((element) => {
      const style = getComputedStyle(element);
      return { thickness: style.textDecorationThickness, offset: style.textUnderlineOffset };
    });
    expect(underline.thickness).toBe('1px');
    expect(underline.offset).not.toBe('auto');

    const answerLink = page.locator('#pain .answer-link');
    await answerLink.focus();
    const focus = await answerLink.evaluate((element) => {
      const style = getComputedStyle(element);
      return { offset: style.outlineOffset, shadow: style.boxShadow };
    });
    expect(focus.offset).toBe('3px');
    expect(focus.shadow).not.toBe('none');

    const faq = page.locator('#faq details').first();
    await faq.locator('summary').click();
    await expect.poll(() => faq.evaluate((element) => getComputedStyle(element).paddingLeft))
      .toBe('16px');
    const open = await faq.evaluate((element) => {
      const style = getComputedStyle(element);
      const question = getComputedStyle(element.querySelector('.question')!);
      return { padding: style.paddingLeft, shadow: style.boxShadow, weight: question.fontWeight };
    });
    expect(open.padding).toBe('16px');
    expect(open.shadow).not.toBe('none');
    expect(open.weight).toBe('600');
  });

  test('Ф-10: только статичная ось совпадает с центрами крайних точек', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const geometry = await page.evaluate(() => {
      const axis = document.querySelector<HTMLElement>('.rail-axis')!;
      const dots = [...document.querySelectorAll<HTMLElement>('.rail .dot')];
      const a = axis.getBoundingClientRect();
      const first = dots[0].getBoundingClientRect();
      const last = dots.at(-1)!.getBoundingClientRect();
      const style = getComputedStyle(axis);
      return {
        children: axis.childElementCount,
        animation: style.animationName,
        axisX: a.left + a.width / 2,
        axisTop: a.top,
        axisBottom: a.bottom,
        firstX: first.left + first.width / 2,
        firstY: first.top + first.height / 2,
        lastY: last.top + last.height / 2,
      };
    });
    expect(geometry.children).toBe(0);
    expect(geometry.animation).toBe('none');
    expect(geometry.axisX).toBeCloseTo(geometry.firstX, 1);
    expect(geometry.axisTop).toBeCloseTo(geometry.firstY, 1);
    expect(geometry.axisBottom).toBeCloseTo(geometry.lastY, 1);
  });

  test('линия использует финальный слой deco и не продолжает документ за подвал', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const result = await page.evaluate(() => {
      const line = document.querySelector<HTMLElement>('.line')!;
      const last = document.querySelector<HTMLElement>('[data-line-last]')!;
      return {
        z: getComputedStyle(line).zIndex,
        overflow: getComputedStyle(last).overflow,
        footerBottom: Math.round(last.getBoundingClientRect().bottom + window.scrollY),
        scrollHeight: document.documentElement.scrollHeight,
      };
    });
    expect(result.z).toBe('-3');
    expect(result.overflow).toContain('clip');
    expect(Math.abs(result.footerBottom - result.scrollHeight)).toBeLessThanOrEqual(1);
  });
});

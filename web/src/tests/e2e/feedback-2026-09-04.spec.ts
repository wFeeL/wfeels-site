import { expect, test, type Page } from '@playwright/test';

async function lineHeadPx(page: Page): Promise<number> {
  return page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:fixed;top:var(--line-head);visibility:hidden';
    document.body.appendChild(probe);
    const top = probe.getBoundingClientRect().top;
    probe.remove();
    return top;
  });
}

async function scrollToLineY(page: Page, documentY: number): Promise<void> {
  const head = await lineHeadPx(page);
  await page.evaluate((y) => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, y);
  }, Math.max(0, Math.round(documentY - head)));
  await page.waitForTimeout(120);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.waitForTimeout(250);
});

test('ссылка «Отзывы» идёт сразу после «Обо мне» в обеих версиях меню', async ({ page }) => {
  const desktop = (await page.locator('header .nav-link:not(.stacked)').allTextContents()).map((text) => text.trim());
  const mobile = (await page.locator('header .nav-link.stacked').allTextContents()).map((text) => text.trim());

  expect(desktop.slice(-2)).toEqual(['Обо мне', 'Отзывы']);
  expect(mobile.slice(-2)).toEqual(['Обо мне', 'Отзывы']);
  await expect(page.locator('header a[href="/#reviews"]')).toHaveCount(2);
});

test('имя продолжает цитату, а специализация и проект стоят отдельной строкой ниже', async ({ page }) => {
  const paragraph = page.locator('#reviews blockquote > p');
  await expect(paragraph).toHaveCount(1);
  await expect(paragraph.locator(':scope > .quote')).toHaveCount(1);
  await expect(paragraph.locator(':scope > .attribution')).toHaveCount(1);
  await expect(paragraph.locator(':scope > .attribution-details')).toHaveCount(1);

  const quote = (await paragraph.locator('.quote').textContent())?.trim() ?? '';
  const attribution = (await paragraph.locator('.attribution').textContent())?.trim() ?? '';
  const details = paragraph.locator('.attribution-details');
  expect(quote.startsWith('«')).toBe(true);
  expect(quote.endsWith('»')).toBe(true);
  expect(attribution).toBe('— Владелица бренда');
  expect(attribution).not.toContain('·');
  await expect(details).toHaveText('сумки ручной работы Telegram Mini App');
  await expect(details).toHaveCSS('display', 'flex');

  const placement = await paragraph.evaluate((el) => {
    const author = el.querySelector('.attribution')!.getBoundingClientRect();
    const meta = el.querySelector('.attribution-details')!.getBoundingClientRect();
    return { authorBottom: author.bottom, metaTop: meta.top };
  });
  expect(placement.metaTop).toBeGreaterThanOrEqual(placement.authorBottom - 1);
  await expect(page.locator('#reviews blockquote + figcaption')).toHaveCount(0);
});

test('рекомендуемый тариф начинает проявляться в кадре владельца 2048×1151', async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 1151 });
  await page.reload();
  await page.waitForTimeout(250);

  const card = page.locator('#pricing .top-grid > .card').nth(1);
  const plain = page.locator('#pricing .top-grid > .card').nth(2);
  const badge = card.locator('.badge');
  const highlight = card.locator('.recommendation-surface');
  const buttonHighlight = card.locator('.recommendation-button-fill');
  const alignHeading = async (viewportY: number) => {
    await page.locator('#pricing h2').evaluate((el, targetY) => {
      document.documentElement.style.scrollBehavior = 'auto';
      const documentTop = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, Math.round(documentTop - targetY));
    }, viewportY);
    await page.waitForTimeout(120);
  };

  await alignHeading(465);
  const before = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
  const plainBefore = await plain.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(before).toBe(plainBefore);
  await expect(highlight).toHaveCSS('opacity', '0');
  await expect(badge).toHaveCSS('opacity', '0');
  await expect(buttonHighlight).toHaveCSS('translate', '-100%');

  // На присланном кадре верх h2 находится примерно на 385 px, верх карточек —
  // около 670 px, а голова линии — на 80vh. Здесь акцент только начинает ход.
  await alignHeading(385);
  const contact = await highlight.evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(contact).toBeGreaterThan(0);
  expect(contact).toBeLessThan(0.5);
  expect(await badge.evaluate((el) => Number(getComputedStyle(el).opacity))).toBeGreaterThan(0);
  expect(parseFloat(await buttonHighlight.evaluate((el) => getComputedStyle(el).translate)))
    .toBeGreaterThan(-100);

  await alignHeading(321);
  const middle = await highlight.evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(middle).toBeGreaterThan(0.1);
  expect(middle).toBeLessThan(0.9);
  const buttonMiddle = await card.locator('.recommendation-button-wrap').evaluate((el) => {
    const fill = el.querySelector('.recommendation-button-fill')!;
    const label = el.querySelector('.recommendation-button-label')!;
    return {
      opacity: getComputedStyle(fill).opacity,
      translate: parseFloat(getComputedStyle(fill).translate),
      wrapperLeft: el.getBoundingClientRect().left,
      labelLeft: label.getBoundingClientRect().left,
    };
  });
  expect(buttonMiddle.opacity).toBe('1');
  expect(buttonMiddle.translate).toBeGreaterThan(-90);
  expect(buttonMiddle.translate).toBeLessThan(-10);
  expect(Math.abs(buttonMiddle.wrapperLeft - buttonMiddle.labelLeft)).toBeLessThan(0.5);

  await alignHeading(225);
  await expect(highlight).toHaveCSS('opacity', '1');
  await expect(badge).toHaveCSS('opacity', '1');
  await expect(buttonHighlight).toHaveCSS('translate', '0%');
});

test('цифра процесса плавно меняет собственный цвет без наложенной копии', async ({ page }) => {
  const number = page.locator('#process .num').first();
  const duplicate = await number.evaluate((el) => getComputedStyle(el, '::after').content);
  expect(duplicate).toBe('none');

  const box = await number.boundingBox();
  expect(box).not.toBeNull();
  const scrollY = await page.evaluate(() => window.scrollY);
  const bottom = box!.y + scrollY + box!.height;

  await scrollToLineY(page, bottom - 12);
  const before = await number.evaluate((el) => getComputedStyle(el).color);
  await scrollToLineY(page, bottom + 64);
  const middle = await number.evaluate((el) => getComputedStyle(el).color);
  await scrollToLineY(page, bottom + 144);
  const after = await number.evaluate((el) => getComputedStyle(el).color);
  expect(middle).not.toBe(before);
  expect(middle).not.toBe(after);
  expect(after).not.toBe(before);

  await expect(number).toHaveCSS('animation-timing-function', 'cubic-bezier(0.65, 0, 0.35, 1)');

  const stable: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    await page.waitForTimeout(50);
    stable.push(await number.evaluate((el) => getComputedStyle(el).color));
  }
  expect(new Set(stable)).toEqual(new Set([after]));
});

test('CTA заполняется одним непрерывным слоем с мягким easing, без пяти ступеней', async ({ page }) => {
  const cta = page.locator('.cta-primary-wrap');
  await expect(cta.locator('.cta-ignite-step')).toHaveCount(0);
  const fill = cta.locator('.cta-ignite-fill');
  const label = cta.locator('.cta-ignite-label');
  await expect(fill).toHaveCount(1);
  await expect(fill).toHaveCSS('animation-timing-function', 'cubic-bezier(0.65, 0, 0.35, 1)');
  await expect(label).toHaveCSS('animation-timing-function', 'cubic-bezier(0.65, 0, 0.35, 1)');
});

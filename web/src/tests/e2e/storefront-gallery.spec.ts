import { test, expect } from '@playwright/test';

const GALLERY = '[data-storefront-gallery]';
const SCREEN = '[data-storefront-screen]';

async function expectLoaded(page: import('@playwright/test').Page, file: string, alt: RegExp) {
  const image = page.locator(`${GALLERY} ${SCREEN}`);
  await expect(image).toHaveAttribute('src', `/cases/storefront/${file}`);
  await expect(image).toHaveAttribute('alt', alt);
  await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
    .toBe(780);
  await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalHeight))
    .toBe(1688);
  await expect.poll(async () => (await image.boundingBox())?.width ?? 0)
    .toBeGreaterThanOrEqual(240);
}

test.describe('галерея кейса Telegram Mini App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator(GALLERY).scrollIntoViewIfNeeded();
  });

  test('стрелки проходят все девять экранов сквозным циклом между магазинами', async ({ page }) => {
    const next = page.getByRole('button', { name: 'Следующий экран', exact: true });
    const previous = page.getByRole('button', { name: 'Предыдущий экран', exact: true });
    const store = page.locator(`${GALLERY} [data-storefront-store]`);
    const counter = page.locator(`${GALLERY} [data-storefront-counter]`);

    await expectLoaded(page, 'yasmina-home.avif', /Главная Yasmina/);
    await expect(store).toHaveText('Yasmina');
    await expect(counter).toHaveText('01 / 09');
    await expect(page.locator(`${GALLERY} [data-app-index]`)).toHaveCount(0);
    await expect(page.locator(`${GALLERY} [data-screen-index]`)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Mariosa|Zayac|Yasmina/ })).toHaveCount(0);

    await next.click();
    await expectLoaded(page, 'yasmina-product.avif', /Fuchsia Marshmallow/);
    await expect(store).toHaveText('Yasmina');
    await expect(counter).toHaveText('02 / 09');

    await next.click();
    await expectLoaded(page, 'yasmina-cart.avif', /Корзина Yasmina/);
    await expect(counter).toHaveText('03 / 09');

    await next.click();
    await expectLoaded(page, 'mariosa-home.avif', /Главная Mariosa Jewelry/);
    await expect(store).toHaveText('Mariosa');
    await expect(counter).toHaveText('04 / 09');

    await next.click();
    await expectLoaded(page, 'mariosa-product.avif', /аметистового сотуара/);
    await next.click();
    await expectLoaded(page, 'mariosa-cart.avif', /Корзина Mariosa/);

    await next.click();
    await expectLoaded(page, 'zayac-home.avif', /Главная Zayac/);
    await expect(store).toHaveText('Zayac');
    await expect(counter).toHaveText('07 / 09');

    await next.click();
    await expectLoaded(page, 'zayac-catalog.avif', /Каталог Zayac/);
    await next.click();
    await expectLoaded(page, 'zayac-product.avif', /белой базовой модели/);
    await expect(counter).toHaveText('09 / 09');

    await next.click();
    await expectLoaded(page, 'yasmina-home.avif', /Главная Yasmina/);
    await expect(store).toHaveText('Yasmina');
    await expect(counter).toHaveText('01 / 09');

    await previous.click();
    await expectLoaded(page, 'zayac-product.avif', /белой базовой модели/);
    await expect(store).toHaveText('Zayac');
    await expect(counter).toHaveText('09 / 09');
  });

  test('на первой загрузке запрашивается только главный экран Yasmina', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/cases/storefront/')) requested.push(request.url());
    });
    await page.reload();
    await page.locator(GALLERY).scrollIntoViewIfNeeded();
    await expectLoaded(page, 'yasmina-home.avif', /Главная Yasmina/);
    expect(requested.map((url) => new URL(url).pathname)).toEqual([
      '/cases/storefront/yasmina-home.avif',
    ]);
  });

  test('обычный режим: скрин мягко уходит и входит в направлении стрелки', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload();
    const gallery = page.locator(GALLERY);
    const image = gallery.locator(SCREEN);
    await gallery.scrollIntoViewIfNeeded();
    await expectLoaded(page, 'yasmina-home.avif', /Главная Yasmina/);

    await page.getByRole('button', { name: 'Следующий экран', exact: true }).click();
    await expect.poll(() => image.evaluate((node) => node.getAnimations().length))
      .toBeGreaterThan(0);
    await expectLoaded(page, 'yasmina-product.avif', /Fuchsia Marshmallow/);
    await expect.poll(() => gallery.getAttribute('data-transitioning')).toBe('idle');
    await expect.poll(() => image.evaluate((node) => node.getAnimations().length)).toBe(0);
    const settled = await image.evaluate((node) => {
      const style = getComputedStyle(node);
      return { opacity: style.opacity, transform: style.transform };
    });
    expect(settled).toEqual({ opacity: '1', transform: 'none' });
  });

  test('reduce: переключение мгновенное и без созданных анимаций', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    const gallery = page.locator(GALLERY);
    const image = gallery.locator(SCREEN);
    await gallery.scrollIntoViewIfNeeded();
    await expectLoaded(page, 'yasmina-home.avif', /Главная Yasmina/);

    await page.getByRole('button', { name: 'Следующий экран', exact: true }).click();
    await expectLoaded(page, 'yasmina-product.avif', /Fuchsia Marshmallow/);
    await expect(gallery).toHaveAttribute('data-transitioning', 'idle');
    expect(await image.evaluate((node) => node.getAnimations().length)).toBe(0);
  });

  for (const viewport of [
    { width: 390, height: 844, minImageWidth: 290, maxImageWidth: 302 },
    { width: 1180, height: 800, minImageWidth: 309, maxImageWidth: 315 },
    { width: 1330, height: 848, minImageWidth: 331, maxImageWidth: 337 },
    { width: 1180, height: 1000, minImageWidth: 388, maxImageWidth: 392 },
  ]) {
    test(`${viewport.width}x${viewport.height}: скрин целиком помещается между шапкой и CTA`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.reload();
      const gallery = page.locator(GALLERY);
      await gallery.scrollIntoViewIfNeeded();
      await expectLoaded(page, 'yasmina-home.avif', /Главная Yasmina/);

      // Ставим верх галереи сразу под sticky-шапку: проверяем, что при
      // обычной позиции чтения весь кадр и подпись одновременно видны, а
      // не поведение служебного `scrollIntoViewIfNeeded`, которое центрует
      // элемент и не учитывает перекрытие липкой шапкой.
      await gallery.evaluate((node) => {
        document.documentElement.style.scrollBehavior = 'auto';
        const header = document.querySelector('header');
        const headerHeight = header?.getBoundingClientRect().height ?? 0;
        window.scrollTo(0, window.scrollY + node.getBoundingClientRect().top - headerHeight - 8);
      });
      await expect.poll(async () => (await gallery.boundingBox())?.y ?? 0)
        .toBeGreaterThanOrEqual(72);

      const overflow = await page.evaluate(() => ({
        viewport: innerWidth,
        body: document.body.scrollWidth,
        document: document.documentElement.scrollWidth,
      }));
      expect(overflow.body).toBeLessThanOrEqual(overflow.viewport);
      expect(overflow.document).toBeLessThanOrEqual(overflow.viewport);

      const row = page.locator('#cases .row').nth(1);
      const text = row.locator('.text');
      const field = row.locator('.field');
      const screenshot = gallery.locator(SCREEN);
      const meta = gallery.locator('.meta');
      const [rowBox, textBox, fieldBox, screenshotBox, metaBox] = await Promise.all([
        row.boundingBox(), text.boundingBox(), field.boundingBox(),
        screenshot.boundingBox(), meta.boundingBox(),
      ]);
      for (const box of [rowBox, textBox, fieldBox, screenshotBox, metaBox]) {
        expect(box).not.toBeNull();
      }

      expect(await gallery.locator('.phone').count()).toBe(0);
      expect(screenshotBox!.width).toBeGreaterThanOrEqual(viewport.minImageWidth);
      expect(screenshotBox!.width).toBeLessThanOrEqual(viewport.maxImageWidth);
      /* Bare-поле принимает фактическую высоту галереи: строка не резервирует
         невидимый 800 px холст и при этом скрин не выходит в её padding. */
      expect(screenshotBox!.y).toBeGreaterThanOrEqual(rowBox!.y);
      expect(metaBox!.y + metaBox!.height)
        .toBeLessThanOrEqual(rowBox!.y + rowBox!.height);
      expect(Math.abs(metaBox!.x - screenshotBox!.x)).toBeLessThan(1);
      expect(Math.abs(metaBox!.width - screenshotBox!.width)).toBeLessThan(1);
      await expect(gallery.locator('[data-storefront-store]')).toHaveText('Yasmina');
      await expect(gallery.locator('[data-app-index], [data-screen-index]')).toHaveCount(0);

      const headerBox = await page.locator('header').boundingBox();
      expect(headerBox).not.toBeNull();
      const ctaBox = await page.locator('.mobile-cta-bar').boundingBox();
      const galleryBox = await gallery.boundingBox();
      expect(galleryBox).not.toBeNull();
      expect(Math.abs(fieldBox!.height - galleryBox!.height)).toBeLessThan(1);
      expect(galleryBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
      expect(galleryBox!.y + galleryBox!.height)
        .toBeLessThanOrEqual((ctaBox?.y ?? viewport.height) + 1);

      const fieldStyle = await field.evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          background: style.backgroundColor,
          borderTopWidth: style.borderTopWidth,
          paddingTop: style.paddingTop,
        };
      });
      expect(fieldStyle.background).toBe('rgba(0, 0, 0, 0)');
      expect(fieldStyle.borderTopWidth).toBe('0px');
      expect(fieldStyle.paddingTop).toBe('0px');

      const renderedRatio = screenshotBox!.width / screenshotBox!.height;
      expect(renderedRatio).toBeCloseTo(780 / 1688, 2);

      if (viewport.width >= 900) {
        expect(fieldBox!.x).toBeLessThan(textBox!.x);
        const textCenter = textBox!.y + textBox!.height / 2;
        const galleryCenter = galleryBox!.y + galleryBox!.height / 2;
        expect(Math.abs(textCenter - galleryCenter)).toBeLessThan(1);
      } else {
        expect(textBox!.y).toBeLessThan(fieldBox!.y);
      }

      for (const button of await gallery.getByRole('button').all()) {
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    });
  }
});

import { test, expect } from '@playwright/test';

const GALLERY = '[data-website-gallery]';
const SCREEN = '[data-website-screen]';

const slides = [
  ['relayos/01-home.avif', /Главная страница RelayOS/, 1586, 992, 'RelayOS'],
  ['relayos/02-workflow-builder.avif', /Конструктор автоматизаций RelayOS/, 1586, 992, 'RelayOS'],
  ['relayos/03-connections.avif', /Раздел подключений RelayOS/, 1586, 992, 'RelayOS'],
  ['still-house/01-home.avif', /Главная страница бутик-отеля/, 1586, 992, 'Still House'],
  ['still-house/02-rooms.webp', /Каталог номеров Still House/, 1586, 992, 'Still House'],
  ['still-house/03-room-booking.webp', /Страница номера Still House/, 1586, 992, 'Still House'],
  ['forma-editions/01-home.avif', /Главная страница галереи/, 1586, 992, 'Forma Editions'],
  ['forma-editions/02-collection.avif', /Каталог предметов Forma Editions/, 1586, 992, 'Forma Editions'],
  ['forma-editions/03-product.avif', /Карточка кресла Arc Chair 02/, 1586, 992, 'Forma Editions'],
] as const;

async function openGallery(page: import('@playwright/test').Page) {
  await page.goto('/');
  const gallery = page.locator(GALLERY);
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery).toHaveAttribute('data-loaded', 'true');
  await expect(gallery).toHaveAttribute('aria-busy', 'false');
  const buttons = gallery.getByRole('button');
  await expect(buttons).toHaveCount(2);
  for (const button of await buttons.all()) await expect(button).toBeEnabled();
}

async function expectLoaded(
  page: import('@playwright/test').Page,
  slide: (typeof slides)[number],
  index: number,
) {
  const [file, alt, width, height, project] = slide;
  const image = page.locator(`${GALLERY} ${SCREEN}`);
  await expect(image).toHaveAttribute('src', `/cases/websites/${file}`);
  await expect(image).toHaveAttribute('alt', alt);
  await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
    .toBe(width);
  await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalHeight))
    .toBe(height);
  await expect(page.locator(`${GALLERY} [data-website-site]`)).toHaveText(project);
  await expect(page.locator(`${GALLERY} [data-website-counter]`))
    .toHaveText(`${String(index + 1).padStart(2, '0')} / 09`);

  /* `naturalWidth` не доказывает, что декодер действительно отдал пиксели:
     два AVIF Still House сообщали размеры, но Chromium рисовал прозрачный
     кадр. Маленький canvas ловит именно видимое содержимое без снапшота. */
  await expect.poll(() => image.evaluate((node) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 40;
    const context = canvas.getContext('2d');
    if (!context) return false;
    context.drawImage(node as HTMLImageElement, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let min = 255;
    let max = 0;
    let opaque = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      min = Math.min(min, pixels[offset], pixels[offset + 1], pixels[offset + 2]);
      max = Math.max(max, pixels[offset], pixels[offset + 1], pixels[offset + 2]);
      if (pixels[offset + 3] > 0) opaque += 1;
    }
    return opaque > 2_000 && max - min > 10;
  })).toBe(true);
}

test.describe('галерея кейса сайтов', () => {
  test('первый кадр загружается только при приближении к секции', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/cases/websites/')) requested.push(request.url());
    });

    await page.goto('/');
    const gallery = page.locator(GALLERY);
    await expect(gallery.locator(SCREEN)).not.toHaveAttribute('src', /.+/);
    expect(requested).toEqual([]);

    await gallery.scrollIntoViewIfNeeded();
    await expectLoaded(page, slides[0], 0);
    expect(requested.map((url) => new URL(url).pathname)).toEqual([
      '/cases/websites/relayos/01-home.avif',
    ]);
  });

  test('стрелки проходят все девять экранов единым циклом между сайтами', async ({ page }) => {
    await openGallery(page);
    const next = page.getByRole('button', { name: 'Следующий экран сайта' });
    const previous = page.getByRole('button', { name: 'Предыдущий экран сайта' });

    await expectLoaded(page, slides[0], 0);
    for (let i = 1; i < slides.length; i++) {
      await next.click();
      await expectLoaded(page, slides[i], i);
    }
    await next.click();
    await expectLoaded(page, slides[0], 0);
    await previous.click();
    await expectLoaded(page, slides[8], 8);
  });

  test('обычный режим анимирует смену, reduce переключает мгновенно', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openGallery(page);
    const gallery = page.locator(GALLERY);
    const image = gallery.locator(SCREEN);

    await page.getByRole('button', { name: 'Следующий экран сайта' }).click();
    await expect.poll(() => image.evaluate((node) => node.getAnimations().length))
      .toBeGreaterThan(0);
    await expectLoaded(page, slides[1], 1);
    await expect.poll(() => gallery.getAttribute('data-transitioning')).toBe('idle');
    await expect.poll(() => image.evaluate((node) => node.getAnimations().length)).toBe(0);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await gallery.scrollIntoViewIfNeeded();
    await expectLoaded(page, slides[0], 0);
    await page.getByRole('button', { name: 'Следующий экран сайта' }).click();
    await expectLoaded(page, slides[1], 1);
    await expect(gallery).toHaveAttribute('data-transitioning', 'idle');
    expect(await image.evaluate((node) => node.getAnimations().length)).toBe(0);
  });

  test('при отказе decode старый кадр остаётся видимым до загрузки нового', async ({ page }) => {
    await page.addInitScript(() => {
      HTMLImageElement.prototype.decode = () =>
        Promise.reject(new DOMException('Искусственный отказ decode'));
    });
    await page.route('**/cases/websites/still-house/02-rooms.webp', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      await route.continue();
    });
    await openGallery(page);

    const gallery = page.locator(GALLERY);
    const image = gallery.locator(SCREEN);
    const next = page.getByRole('button', { name: 'Следующий экран сайта' });
    for (let index = 1; index <= 3; index++) {
      await next.click();
      await expectLoaded(page, slides[index], index);
      await expect(gallery).toHaveAttribute('data-transitioning', 'idle');
    }

    await next.click();
    await page.waitForTimeout(500);

    await expectLoaded(page, slides[3], 3);
    await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);

    await expectLoaded(page, slides[4], 4);
    await expect(gallery).toHaveAttribute('data-transitioning', 'idle');
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1180, height: 800 },
    { width: 1180, height: 1000 },
  ]) {
    test(`${viewport.width}x${viewport.height}: текст слева, скрин справа и без обрезки`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openGallery(page);

      const row = page.locator('#cases .row').nth(2);
      const text = row.locator('.text');
      const field = row.locator('.field');
      const gallery = page.locator(GALLERY);
      const stage = gallery.locator('.stage');
      const image = gallery.locator(SCREEN);
      const [textBox, fieldBox, stageBox] = await Promise.all([
        text.boundingBox(), field.boundingBox(), stage.boundingBox(),
      ]);
      for (const box of [textBox, fieldBox, stageBox]) expect(box).not.toBeNull();

      const styles = await image.evaluate((node) => {
        const style = getComputedStyle(node);
        return { objectFit: style.objectFit, width: style.width, height: style.height };
      });
      expect(styles.objectFit).toBe('contain');
      expect(stageBox!.height).toBeLessThanOrEqual(viewport.height - 120);

      if (viewport.width >= 900) {
        expect(textBox!.x).toBeLessThan(fieldBox!.x);
        const textCenter = textBox!.y + textBox!.height / 2;
        const galleryBox = await gallery.boundingBox();
        expect(galleryBox).not.toBeNull();
        const galleryCenter = galleryBox!.y + galleryBox!.height / 2;
        expect(Math.abs(textCenter - galleryCenter)).toBeLessThan(1);
      } else {
        expect(textBox!.y).toBeLessThan(fieldBox!.y);
      }

      const overflow = await page.evaluate(() => ({
        viewport: innerWidth,
        body: document.body.scrollWidth,
        document: document.documentElement.scrollWidth,
      }));
      expect(overflow.body).toBeLessThanOrEqual(overflow.viewport);
      expect(overflow.document).toBeLessThanOrEqual(overflow.viewport);

      for (const button of await gallery.getByRole('button').all()) {
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
    });
  }
});

import { test, expect } from '@playwright/test';

/** Сторож финального состояния рекомендуемого тарифа. До прохода линии карточка
 *  нейтральна (это проверяет `feedback-2026-09-04.spec.ts`); после выхода пера
 *  отдельная `.recommendation-surface` показывает непрозрачную акцентную
 *  поверхность. Здесь цвет проверяется по реальному пикселю снимка, поскольку
 *  вычисленный `backgroundColor` не учитывает верхний слой `background-image`. */

const VIEWPORT = { width: 1440, height: 900 };
const MIN_AA = 4.5;
// Допуск на округление PNG и лёгкое сглаживание рядом с рамкой/паддингом.
const PIXEL_TOLERANCE = 3;

type Rgb = [number, number, number];

/** Chromium сериализует вычисленное значение `--accent-soft` не буквальной
 *  строкой токена (`rgba(47, 91, 255, 0.09)`), а восьмизначным hex
 *  (`#2f5bff17`) — оба формата разбираются, второй встречается на практике. */
function parseAccentSoftAlpha(value: string): number {
  const rgbaMatch = /rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)/.exec(value);
  if (rgbaMatch) return Number(rgbaMatch[1]);
  const hexMatch = /^#[0-9a-f]{6}([0-9a-f]{2})$/i.exec(value.trim());
  if (hexMatch) return parseInt(hexMatch[1], 16) / 255;
  throw new Error(`не удалось разобрать альфу --accent-soft: ${value}`);
}

/** Chromium сериализует вычисленное значение custom property в кратчайшую
 *  форму — `#fff`, не `#ffffff` (та же нормализация, что превратила
 *  `rgba(...)` в 8-значный hex у `parseAccentSoftAlpha` выше). Оба варианта
 *  длины разбираются. */
function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '').trim();
  if (h.length === 3) {
    return h.split('').map((c) => parseInt(c + c, 16)) as Rgb;
  }
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

function relLum([r, g, b]: Rgb): number {
  const c = (v: number) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}
function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function blend(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return fg.map((v, i) => alpha * v + (1 - alpha) * bg[i]) as Rgb;
}

async function pixelAt(page: import('@playwright/test').Page, x: number, y: number): Promise<Rgb> {
  const buf = await page.screenshot({ clip: { x: Math.round(x) - 1, y: Math.round(y) - 1, width: 3, height: 3 } });
  const rgb = await page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('decode failed'));
      img.src = `data:image/png;base64,${b64}`;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(1, 1, 1, 1).data;
    return [d[0], d[1], d[2]] as Rgb;
  }, buf.toString('base64'));
  return rgb;
}

test.describe('карточка-акцент секции «Цены» — лицо непрозрачно, тон акцента остаётся (П-Ц1)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`тема «${theme}»: пиксель лица совпадает с непрозрачным составом accent-soft-над-surface, отличается от соседней карточки`, async ({ page }) => {
      await page.setViewportSize(VIEWPORT);
      await page.goto('/');

      if (theme === 'dark') {
        await page.locator('#theme-toggle').click();
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
      }

      // Карточки ниже первого экрана — `page.screenshot({ clip })` снимает
      // из ТЕКУЩЕГО кадра страницы, а не всего документа: без прокрутки
      // координаты `getBoundingClientRect()` уводят клип за пределы вьюпорта.
      const recommended = page.locator('#pricing .top-grid > .recommended-card');
      const bottom = await recommended.evaluate((el) => el.getBoundingClientRect().bottom + window.scrollY);
      const lineHead = await page.evaluate(() => {
        const probe = document.createElement('i');
        probe.style.cssText = 'position:fixed;top:var(--line-head);visibility:hidden';
        document.body.appendChild(probe);
        const top = probe.getBoundingClientRect().top;
        probe.remove();
        return top;
      });
      // D-152: акцент уже завершён у нижней кромки карточки; ещё +208 px
      // ставят пиксельный замер заведомо после диапазона, а не внутри смеси.
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(bottom - lineHead + 208));
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

      const setup = await page.evaluate(() => {
        const accentCard = document.querySelector('#pricing .top-grid > .recommended-card') as HTMLElement | null;
        const plainCard = document.querySelector('#pricing .top-grid > .card:not(.recommended-card)') as HTMLElement | null;
        if (!accentCard || !plainCard) return null;
        const ar = accentCard.getBoundingClientRect();
        const pr = plainCard.getBoundingClientRect();
        const root = getComputedStyle(document.documentElement);
        return {
          theme: document.documentElement.dataset.theme ?? 'light',
          // Точка у правого края карточки, посередине по высоте — вне угловых
          // засечек (`.card::before`, 12px от каждого угла) и вне ховер-лампы
          // (`.card::after`, требует `:hover`).
          accentPoint: { x: ar.left + ar.width - 15, y: ar.top + ar.height / 2 },
          plainPoint: { x: pr.left + pr.width - 15, y: pr.top + pr.height / 2 },
          accentTokenHex: root.getPropertyValue('--accent').trim(),
          surfaceTokenHex: root.getPropertyValue('--surface').trim(),
          textTokenHex: root.getPropertyValue('--text').trim(),
          textMutedTokenHex: root.getPropertyValue('--text-muted').trim(),
          accentSoftRaw: root.getPropertyValue('--accent-soft').trim(),
        };
      });
      expect(setup, 'не нашёл на странице обе карточки #pricing .top-grid > .card').not.toBeNull();
      const s = setup!;

      const accentToken = hexToRgb(s.accentTokenHex);
      const surfaceToken = hexToRgb(s.surfaceTokenHex);
      const text = hexToRgb(s.textTokenHex);
      const textMuted = hexToRgb(s.textMutedTokenHex);
      const alpha = parseAccentSoftAlpha(s.accentSoftRaw);
      const expectedAccentPixel = blend(accentToken, surfaceToken, alpha);

      const accentPixel = await pixelAt(page, s.accentPoint.x, s.accentPoint.y);
      const plainPixel = await pixelAt(page, s.plainPoint.x, s.plainPoint.y);

      // eslint-disable-next-line no-console
      console.log(
        `${theme}: точка акцента=${accentPixel.join(',')}, ожидание=${expectedAccentPixel.map((v) => Math.round(v)).join(',')}, `
        + `сосед=${plainPixel.join(',')}, --surface=${surfaceToken.join(',')}, альфа --accent-soft=${alpha}`,
      );

      // Ядро сторожа 1: лицо карточки-акцента совпадает с НЕПРОЗРАЧНЫМ
      // составом accent-soft-над-surface — не плоским `--surface` (калька
      // вернулась бы к этому), не полупрозрачным «сквозь него видно линию»
      // (старый дефект).
      for (let i = 0; i < 3; i++) {
        expect(
          Math.abs(accentPixel[i] - expectedAccentPixel[i]),
          `канал ${i}: пиксель лица карточки-акцента ${accentPixel.join(',')} разошёлся с ожидаемым непрозрачным составом ${expectedAccentPixel.map((v) => Math.round(v)).join(',')}`,
        ).toBeLessThanOrEqual(PIXEL_TOLERANCE);
      }

      // Ядро сторожа 2: заливка отличается от соседней (плоской `--surface`)
      // карточки — тон акцента жив, карточка не потеряла отличие (тот самый
      // дефект специфичности, что чинил Р-2/раздел 10.4 брифа 11).
      const diff = Math.abs(accentPixel[0] - plainPixel[0])
        + Math.abs(accentPixel[1] - plainPixel[1])
        + Math.abs(accentPixel[2] - plainPixel[2]);
      expect(diff, `заливка карточки-акцента ${accentPixel.join(',')} неотличима от соседней ${plainPixel.join(',')} — тон акцента пропал`)
        .toBeGreaterThan(PIXEL_TOLERANCE);

      // Текст остаётся читаемым на непрозрачном композитном фоне.
      expect(contrast(text, expectedAccentPixel), '--text на карточке-акценте ниже AA').toBeGreaterThanOrEqual(MIN_AA);
      expect(contrast(textMuted, expectedAccentPixel), '--text-muted на карточке-акценте ниже AA').toBeGreaterThanOrEqual(MIN_AA);
    });
  }
});

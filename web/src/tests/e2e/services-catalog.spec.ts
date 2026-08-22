import { test, expect } from '@playwright/test';
import { SERVICE_PAGES } from '../../data/servicePages';

/* Сторож дефекта B1, ревью выпуска 2026-08-22: класс `.line` на плитке
 * каталога `/services` (`<p class="line t-small">`, описание услуги)
 * совпадал с ГЛОБАЛЬНЫМ правилом `.line, .line-curtain` фоновой линии
 * (`BackgroundLine.astro`) — от 480 px абзац уходил из потока под карточку
 * (`position: absolute; z-index: -1`) и был невидим на ЛЮБОЙ ширине, а
 * документ растягивался вбок (`scrollWidth` 1280 → 1920, 768 → 1152,
 * 1920 → 2775). Правка: класс плитки переименован в `.tile-line`
 * (`pages/services/index.astro`), а глобальное правило сужено до
 * `svg.line` (`BackgroundLine.astro`) — второе совпадение того же рода
 * больше не может повториться молча.
 *
 * Две проверки ниже держат оба конца дефекта: текст плитки виден и не
 * создаёт горизонтальной прокрутки — на каталоге И на всех девяти
 * посадочных (`/services/*`), где линии на фоне нет (`line={false}`), но
 * тот же класс `.line`/`.tile-line` не должен всплыть снова ни на одной из
 * них. */

const WIDTHS = [375, 768, 1280, 1920];
const ALL_ADDRESSES = ['/services', ...SERVICE_PAGES.map((p) => `/services/${p.slug}`)];

test.describe('B1 — плитка каталога /services: текст описания виден', () => {
  test('.tile-line есть на каждой плитке, видим и не в минус-z-index', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/services');

    const lines = page.locator('.tile-line');
    const count = await lines.count();
    expect(count).toBe(SERVICE_PAGES.length);

    for (let i = 0; i < count; i++) {
      const el = lines.nth(i);
      await expect(el).toBeVisible();
      const box = await el.boundingBox();
      expect(box, `плитка ${i}: нет бокса — вне потока`).not.toBeNull();
      expect(box!.width, `плитка ${i}: нулевая ширина`).toBeGreaterThan(0);
      expect(box!.height, `плитка ${i}: нулевая высота`).toBeGreaterThan(0);

      const zIndex = await el.evaluate((node) => getComputedStyle(node).zIndex);
      expect(zIndex, `плитка ${i}: z-index уводит текст под карточку`).not.toBe('-1');
    }
  });

  for (const width of WIDTHS) {
    test(`${width}px: .tile-line видим (глобальный .line её больше не прячет)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/services');
      await expect(page.locator('.tile-line').first()).toBeVisible();
    });
  }
});

test.describe('B1 — ни одна из десяти страниц не скроллится вбок', () => {
  for (const path of ALL_ADDRESSES) {
    for (const width of WIDTHS) {
      test(`${path} @ ${width}px: scrollWidth === clientWidth`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(path);
        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `лишняя горизонтальная прокрутка ${overflow}px на ${width}px`).toBe(0);
      });
    }
  }
});

/* Сторож W8, ревью выпуска: ссылки хлебных крошек измерялись 61×24 и
 * 52×24 px на 375 — ниже минимума 44 px по высоте. Правка —
 * `Breadcrumbs.astro`, вертикальный `padding`/отрицательный `margin` на
 * `a`. Проверяем на каталоге и на одной посадочной — механика одна и та же
 * для всех страниц (общий компонент). */
test.describe('W8 — цель касания хлебных крошек не меньше 44 px по высоте', () => {
  for (const path of ['/services', '/services/website']) {
    test(`${path} @ 375px`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 900 });
      await page.goto(path);
      const links = page.locator('.breadcrumbs a');
      const count = await links.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const box = await links.nth(i).boundingBox();
        expect(box, `крошка ${i} не отрисована`).not.toBeNull();
        expect(box!.height, `крошка ${i}: высота цели касания`).toBeGreaterThanOrEqual(44);
      }
    });
  }
});

import { test, expect } from '@playwright/test';

/* Дизайн-ревью-блокер 2026-08-18: заголовок первого экрана («автоматизация»
 * на 390 px) и заголовок «Что я гарантирую» (от 1067 px) рвались посреди
 * слова — глобальный `overflow-wrap: break-word` (`base.css`, правило
 * `body`) рубил слово, которое не помещалось в свою колонку, вместо того
 * чтобы перенести его целиком на новую строку. Тот же дефект нашёлся и в
 * `#faq` («спрашивают» от 1180 px) — тот же фиксированный верхний предел
 * колонки числом, не выведенным из содержимого.
 *
 * Правило сторожа общее, не про два конкретных слова: `overflow-wrap:
 * break-word` обязан оставаться ЗАПАСНЫМ путём, а не рабочим механизмом —
 * если убрать его (временно, только для замера) и слово всё равно не
 * помещается в свою колонку без него, значит колонка уже сегодня держится
 * только на грубом разрыве. Разрешённая замена — «мягкий» перенос: либо
 * `hyphens: auto` (`Hero.astro`, `#hero h1`, при верном `lang`), либо
 * колонка, выведенная из содержимого через `min-content` (`Guarantees.astro`,
 * `Faq.astro`) — оба механизма работают независимо от `overflow-wrap` и этот
 * замер не трогают.
 *
 * Проверяет РЕАЛЬНЫЙ рендер в Chromium (сторож зависит от словаря переносов
 * браузера и от раскладки грида — ни то, ни другое не подделать в jsdom),
 * поэтому это e2e-тест, а не юнит. */
const WIDTHS = [390, 700, 900, 1180, 1440];

test.describe('заголовки главной не держатся на грубом разрыве слова', () => {
  for (const width of WIDTHS) {
    test(`ширина ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      const offenders = await page.evaluate(() => {
        const bad: Array<{ text: string; columnWidth: number; neededWidth: number }> = [];
        document.querySelectorAll('main h1, main h2').forEach((node) => {
          const heading = node as HTMLElement;
          const prevValue = heading.style.getPropertyValue('overflow-wrap');
          const prevPriority = heading.style.getPropertyPriority('overflow-wrap');
          // Снимаем запасной путь на время замера — испытываем именно то,
          // что даёт раскладка и перенос сами по себе, без грубой подстраховки.
          heading.style.setProperty('overflow-wrap', 'normal', 'important');
          void heading.offsetWidth; // форсирует layout между сменой стиля и замером
          const columnWidth = heading.clientWidth;
          const neededWidth = heading.scrollWidth;
          if (prevValue) {
            heading.style.setProperty('overflow-wrap', prevValue, prevPriority);
          } else {
            heading.style.removeProperty('overflow-wrap');
          }
          if (neededWidth > columnWidth + 2) {
            bad.push({ text: heading.textContent?.trim() ?? '', columnWidth, neededWidth });
          }
        });
        return bad;
      });

      expect(
        offenders,
        offenders
          .map((o) => `«${o.text}» — колонка ${o.columnWidth}px, без break-word нужно ${o.neededWidth}px`)
          .join('\n'),
      ).toEqual([]);
    });
  }
});

import { test, expect } from '@playwright/test';

/** Сторож на дефект «карточка-акцент потеряла заливку» (проверка брифа
 *  `70-workshop/specs/site-v3/11-line-narrator-brief.md`, раздел 10.4, Р-2 —
 *  «через главный блок»). Причина дефекта — конфликт специфичности CSS:
 *  калька Р-1 (`base.css`, `#pricing .card`, специфичность (1,1,0), id +
 *  класс) перебивала модификатор `.card--accent` внутри `Card.astro`
 *  ((0,2,0) после скоупинга Astro — ниже, хотя объявлен позже) — карточка
 *  «Корпоративный сайт» получала точно ту же непрозрачную-на-62%-заливку
 *  `--surface`, что и соседние тарифы, и переставала быть акцентной по фону.
 *  Ни один прежний тест этого не ловил: все проверки карточки-акцента
 *  (`background-line-narrator.spec.ts`, П-21/П-22) смотрят на геометрию
 *  линии и разметку обводки, а не на `background-color`.
 *
 *  Проверка НАРОЧНО читает `getComputedStyle` на живой странице, а не класс
 *  в разметке или правило в исходном CSS — сравнение по имени класса ловит
 *  только «класс присутствует», а не «фон и правда другой» (ровно так этот
 *  дефект и прошёл зелёным раньше: класс `.card--accent` был на месте,
 *  собственное правило `Card.astro` тоже было на месте, но проигрывало по
 *  специфичности снаружи). Числа считаются по формуле WCAG-контраста, той
 *  же, что использует `BackgroundLine.contrast.test.ts`, но на значениях,
 *  снятых В БРАУЗЕРЕ в момент прогона (токены `--bg`/`--accent`/
 *  `--line-opacity` и собственный `backgroundColor` карточки), а не
 *  вычисленных заранее руками — тест не проверяет статическое число, он
 *  проверяет соотношение, которое обязано держаться при любой правке
 *  токенов. */

const VIEWPORT = { width: 1440, height: 900 };
// Полоса краски сквозь лист обязана остаться различимой — тот же порог,
// что и у обычных карточек калькированной секции (раздел 10.3 брифа).
const MIN_LINE_CONTRAST = 1.06;
const MIN_AA = 4.5;
// Плотность заливки калькированной карточки (Р-1) — 62%. Акцентная
// карточка обязана лежать заметно ниже этого порога, иначе она либо
// вернулась к той же заливке, что соседи (дефект), либо стала непрозрачной
// сверх меры и перестала пропускать линию (переезд Р-2 требует именно это).
const MAX_ACCENT_ALPHA = 0.3;

type Rgb = [number, number, number];

/** Разбирает и `rgba(r, g, b, a)`, и `color(srgb r g b / a)` — Chromium
 *  возвращает первый формат для литеральных `rgba()`-значений (как
 *  `--accent-soft`) и второй для результата `color-mix()` (как заливка
 *  калькированных соседей), а `getComputedStyle` не приводит их к одному
 *  виду сам. */
function parseColor(value: string): { rgb: Rgb; alpha: number } {
  const rgbaMatch = /^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)$/.exec(value);
  if (rgbaMatch) {
    return {
      rgb: [Number(rgbaMatch[1]), Number(rgbaMatch[2]), Number(rgbaMatch[3])],
      alpha: rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1,
    };
  }
  const colorMatch = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/.exec(value);
  if (colorMatch) {
    return {
      rgb: [Number(colorMatch[1]) * 255, Number(colorMatch[2]) * 255, Number(colorMatch[3]) * 255],
      alpha: colorMatch[4] !== undefined ? Number(colorMatch[4]) : 1,
    };
  }
  throw new Error(`не удалось разобрать цвет: ${value}`);
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

async function measure(page: import('@playwright/test').Page) {
  const raw = await page.evaluate(() => {
    const accentCard = document.querySelector('#pricing .top-grid > .card--accent');
    const plainCard = document.querySelector('#pricing .top-grid > .card:not(.card--accent)');
    if (!accentCard || !plainCard) return null;
    const root = getComputedStyle(document.documentElement);
    return {
      theme: document.documentElement.dataset.theme ?? 'light',
      accentBg: getComputedStyle(accentCard).backgroundColor,
      plainBg: getComputedStyle(plainCard).backgroundColor,
      accentTokenHex: root.getPropertyValue('--accent').trim(),
      bgTokenHex: root.getPropertyValue('--bg').trim(),
      textTokenHex: root.getPropertyValue('--text').trim(),
      textMutedTokenHex: root.getPropertyValue('--text-muted').trim(),
      lineOpacity: Number(root.getPropertyValue('--line-opacity').trim()),
    };
  });
  expect(raw, 'не нашёл на странице обе карточки #pricing .top-grid > .card').not.toBeNull();
  const r = raw!;

  const hexToRgb = (hex: string): Rgb => {
    const h = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
  };

  const accent = parseColor(r.accentBg);
  const plain = parseColor(r.plainBg);
  const bg = hexToRgb(r.bgTokenHex);
  const accentToken = hexToRgb(r.accentTokenHex);
  const text = hexToRgb(r.textTokenHex);
  const textMuted = hexToRgb(r.textMutedTokenHex);

  // Ink пикселя линии там, где она лежит под ВСЕМИ поверхностями (z-index
  // -3, `05-line.md`) — акцентный токен, наложенный на `--bg` с шириной-
  // зависимой `--line-opacity`, той же переменной, что читает
  // `BackgroundLine.contrast.test.ts`.
  const lineInk = blend(accentToken, bg, r.lineOpacity);
  const accentOverBg = blend(accent.rgb, bg, accent.alpha);
  const accentOverLine = blend(accent.rgb, lineInk, accent.alpha);

  return {
    theme: r.theme,
    accentAlpha: accent.alpha,
    plainAlpha: plain.alpha,
    accentCss: r.accentBg,
    plainCss: r.plainBg,
    lineThroughCardContrast: contrast(accentOverBg, accentOverLine),
    textOnCard: contrast(text, accentOverBg),
    textMutedOnCard: contrast(textMuted, accentOverBg),
  };
}

test.describe('карточка-акцент секции «Цены» — фон отличается от соседей (дефект «фон стёрла калька»)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`тема «${theme}»: заливка карточки-акцента отличается от соседних карточек, полоса линии и текст держат порог`, async ({ page }) => {
      await page.setViewportSize(VIEWPORT);
      await page.goto('/');

      if (theme === 'dark') {
        await page.locator('#theme-toggle').click();
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
      }

      const m = await measure(page);
      // eslint-disable-next-line no-console
      console.log(
        `${theme}: акцент=${m.accentCss} (alpha=${m.accentAlpha}), сосед=${m.plainCss} (alpha=${m.plainAlpha}), `
        + `линия сквозь карточку=${m.lineThroughCardContrast.toFixed(3)}:1, --text=${m.textOnCard.toFixed(2)}:1, `
        + `--text-muted=${m.textMutedOnCard.toFixed(2)}:1 (способ замера: getComputedStyle в браузере, формула WCAG)`,
      );

      // Ядро сторожа: акцентная карточка обязана иметь ДРУГУЮ вычисленную
      // заливку, чем соседняя карточка той же секции — не «другой класс в
      // разметке», а другой цвет, реально нарисованный браузером.
      expect(m.accentCss, 'заливка карточки-акцента совпала с заливкой соседней карточки — калька Р-1 снова перебивает .card--accent по специфичности')
        .not.toBe(m.plainCss);

      // Плотность заливки-акцента обязана остаться заметно ниже 62% кальки
      // (иначе это снова заливка калькированного соседа, просто случайно
      // совпавшая численно) и при этом не стать непрозрачной — линия обязана
      // читаться сквозь неё.
      expect(m.accentAlpha, `плотность заливки карточки-акцента ${m.accentAlpha} не ниже плотности кальки (0.62) — фон снова совпадает с соседями`)
        .toBeLessThan(MAX_ACCENT_ALPHA);

      expect(m.lineThroughCardContrast, `полоса краски сквозь карточку-акцент ${m.lineThroughCardContrast.toFixed(3)}:1 ниже порога ${MIN_LINE_CONTRAST}:1`)
        .toBeGreaterThanOrEqual(MIN_LINE_CONTRAST);

      expect(m.textOnCard, `--text на карточке-акценте ${m.textOnCard.toFixed(2)}:1 ниже AA`)
        .toBeGreaterThanOrEqual(MIN_AA);
      expect(m.textMutedOnCard, `--text-muted на карточке-акценте ${m.textMutedOnCard.toFixed(2)}:1 ниже AA`)
        .toBeGreaterThanOrEqual(MIN_AA);
    });
  }
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** Приёмка `02-background-line.md`, раздел 9, пункт 4: «Юнит-тест
 *  BackgroundLine.contrast.test.ts расширяется: контраст штриха к --bg
 *  лежит в полосе 1,60…1,80:1 в обеих темах, и --text над штрихом ≥ 4,5:1
 *  в обеих темах». `--text-muted` НЕ проверяется как допуск (пункт 6) —
 *  этот случай запрещён правилом «линия не проходит под текстом»
 *  (раздел 5.2), а не разрешён порогом; машинная форма самого правила —
 *  отдельный e2e-тест (раздел 9, пункт 5), не этот файл. */

const COMPONENT = readFileSync(new URL('./BackgroundLine.astro', import.meta.url), 'utf8');
const TOKENS = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');

function opacityFromComponent(): number {
  // Раздел 7.2 (правка 2026-08-13): цвет штриха задан не `opacity` на
  // stroke, а `color-mix(in srgb, var(--accent) N%, transparent)` в
  // `background-color` — то же самое альфа-смешение, другой синтаксис.
  const m = /color-mix\(in srgb,\s*var\(--accent\)\s*(\d+(?:\.\d+)?)%/.exec(COMPONENT);
  expect(m, 'в BackgroundLine.astro не нашёлся color-mix(var(--accent) N%, ...)').not.toBeNull();
  return Number(m![1]) / 100;
}

function tokenHex(selector: string, name: string): string {
  const start = TOKENS.indexOf(selector);
  expect(start, `в tokens.css нет блока ${selector}`).toBeGreaterThan(-1);
  const open = TOKENS.indexOf('{', start);
  const close = TOKENS.indexOf('}', open);
  const found = new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(TOKENS.slice(open, close));
  expect(found, `в блоке ${selector} нет ${name}`).not.toBeNull();
  return found![1];
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const c = (v: number) => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function blendOverBg(
  fg: [number, number, number], bg: [number, number, number], alpha: number,
): [number, number, number] {
  return fg.map((v, i) => alpha * v + (1 - alpha) * bg[i]) as [number, number, number];
}

const THEMES = {
  светлая: { selector: ':root {', bg: '#F4F6F9', text: '#0F1620', accent: '#2F5BFF' },
  'тёмная по выбору': { selector: ':root[data-theme="dark"]', bg: '#0E1420', text: '#DCE3EE', accent: '#5B84FF' },
} as const;

describe('линия на фоне — контраст (раздел 5, приёмка 9.4)', () => {
  const opacity = opacityFromComponent();

  it('непрозрачность штриха читается из компонента и не равна нулю', () => {
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThan(1);
  });

  for (const [name, t] of Object.entries(THEMES)) {
    const bg = hexToRgb(tokenHex(t.selector, '--bg'));
    const text = hexToRgb(tokenHex(t.selector, '--text'));
    const accent = hexToRgb(tokenHex(t.selector, '--accent'));
    const blended = blendOverBg(accent, bg, opacity);

    it(`тема «${name}»: контраст штриха к --bg лежит в полосе 1,60…1,80:1`, () => {
      const cr = contrast(bg, blended);
      // eslint-disable-next-line no-console
      console.log(`${name}: opacity=${opacity} пиксель штриха ${blended.map((v) => Math.round(v))}, контраст к фону ${cr.toFixed(2)}:1`);
      expect(cr, `контраст штриха к фону ${cr.toFixed(2)}:1 вне полосы 1,60…1,80`).toBeGreaterThanOrEqual(1.6);
      expect(cr, `контраст штриха к фону ${cr.toFixed(2)}:1 вне полосы 1,60…1,80`).toBeLessThanOrEqual(1.8);
    });

    it(`тема «${name}»: контраст --text над штрихом ≥ AA (4.5:1)`, () => {
      const cr = contrast(text, blended);
      console.log(`${name}: контраст текста над штрихом ${cr.toFixed(2)}:1`);
      expect(cr, `контраст ${cr.toFixed(2)}:1 ниже AA`).toBeGreaterThanOrEqual(4.5);
    });
  }
});

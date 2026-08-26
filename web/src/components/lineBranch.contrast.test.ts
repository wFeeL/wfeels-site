import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** Приёмка `70-workshop/specs/site-v3/11-line-narrator-brief.md`, раздел 3
 *  П4, раздел 5 П-9: контраст ветви (`.line-branch`, `color-mix(in srgb,
 *  var(--accent) 45%, var(--bg))`) к `--bg` — 1,7…2,4:1 в обеих темах.
 *  Формула и коэффициенты — те же, что `BackgroundLine.contrast.test.ts`
 *  (не второй расчёт: `hexToRgb → luminance(0.2126/0.7152/0.0722, порог
 *  0.04045, γ 2.4) → (hi+0.05)/(lo+0.05)`), значения токенов читаются из
 *  `tokens.css`, не переписаны вручную. */

const TOKENS = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');

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

/** `color-mix(in srgb, accent 45%, bg)` — линейное смешение в sRGB
 *  (то же приближение, что `blendOverBg` в `BackgroundLine.contrast.
 *  test.ts` использует для `--line-opacity` поверх `--bg`; здесь роль
 *  «непрозрачности» играет доля акцента, 0.45). */
function mix(accent: [number, number, number], bg: [number, number, number], accentShare: number): [number, number, number] {
  return accent.map((v, i) => accentShare * v + (1 - accentShare) * bg[i]) as [number, number, number];
}

const THEMES = {
  светлая: { selector: ':root {', bg: '#F4F6F9', accent: '#2F5BFF' },
  тёмная: { selector: ':root[data-theme="dark"]', bg: '#0E1420', accent: '#5B84FF' },
} as const;

const BRANCH_ACCENT_SHARE = 0.45;
const BAND_LO = 1.7;
const BAND_HI = 2.4;

describe('ветвь линии — контраст к --bg (раздел 3 П4, приёмка П-9, `11-line-narrator-brief.md`)', () => {
  for (const [name, t] of Object.entries(THEMES)) {
    it(`тема «${name}»: color-mix(accent 45%, bg) к --bg лежит в полосе ${BAND_LO}…${BAND_HI}:1`, () => {
      const bg = hexToRgb(tokenHex(t.selector, '--bg'));
      const accent = hexToRgb(tokenHex(t.selector, '--accent'));
      const branchColor = mix(accent, bg, BRANCH_ACCENT_SHARE);
      const cr = contrast(bg, branchColor);
      console.log(`${name}: цвет ветви ${branchColor.map((v) => Math.round(v))}, контраст к фону ${cr.toFixed(3)}:1`);
      expect(cr, `контраст ветви ${cr.toFixed(3)}:1 вне полосы ${BAND_LO}…${BAND_HI}`).toBeGreaterThanOrEqual(BAND_LO);
      expect(cr, `контраст ветви ${cr.toFixed(3)}:1 вне полосы ${BAND_LO}…${BAND_HI}`).toBeLessThanOrEqual(BAND_HI);
    });
  }
});

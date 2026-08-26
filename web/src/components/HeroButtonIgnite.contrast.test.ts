import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** Приёмка `70-workshop/specs/site-v3/11-line-narrator-brief.md`, раздел 3,
 *  П2(а) и раздел 5, П-6б: серое состояние кнопки первого экрана
 *  (`#hero .cta .btn.primary` до прихода линии) — заливка `--border`,
 *  подпись `--text`, из уже объявленных токенов, не подобранный оттенок.
 *  Тот же расчёт, что `BackgroundLine.contrast.test.ts`
 *  (`hexToRgb → luminance(0.2126/0.7152/0.0722, порог 0.04045, γ 2.4) →
 *  (hi+0.05)/(lo+0.05)`), второй формулы не заводится. */

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

const THEMES = {
  светлая: { selector: ':root {', border: '#CBD3DE', text: '#0F1620', accent: '#2F5BFF', textOnAccent: '#FFFFFF' },
  тёмная: { selector: ':root[data-theme="dark"]', border: '#263144', text: '#DCE3EE', accent: '#5B84FF', textOnAccent: '#0E1420' },
} as const;

const EXPECTED = {
  светлая: { grey: 12.04, accent: 5.17 },
  тёмная: { grey: 10.13, accent: 5.43 },
} as const;

describe('кнопка первого экрана — серое состояние до прихода линии (раздел 3, П2(а); приёмка П-6б)', () => {
  for (const [name, t] of Object.entries(THEMES) as [keyof typeof THEMES, (typeof THEMES)[keyof typeof THEMES]][]) {
    const border = hexToRgb(tokenHex(t.selector, '--border'));
    const text = hexToRgb(tokenHex(t.selector, '--text'));
    const accent = hexToRgb(tokenHex(t.selector, '--accent'));
    const textOnAccent = hexToRgb(tokenHex(t.selector, '--text-on-accent'));

    it(`тема «${name}»: --border и --text совпадают с брифом (${t.border} / ${t.text})`, () => {
      expect(tokenHex(t.selector, '--border').toUpperCase()).toBe(t.border);
      expect(tokenHex(t.selector, '--text').toUpperCase()).toBe(t.text);
    });

    it(`тема «${name}»: серое состояние (--text на --border) ≥ AA (4.5:1), фактически ${EXPECTED[name].grey}:1`, () => {
      const cr = contrast(text, border);
      expect(cr, `контраст ${cr.toFixed(2)}:1 ниже AA`).toBeGreaterThanOrEqual(4.5);
      expect(cr).toBeCloseTo(EXPECTED[name].grey, 1);
    });

    it(`тема «${name}»: акцентное состояние (--text-on-accent на --accent) ≥ AA (4.5:1), фактически ${EXPECTED[name].accent}:1`, () => {
      const cr = contrast(textOnAccent, accent);
      expect(cr, `контраст ${cr.toFixed(2)}:1 ниже AA`).toBeGreaterThanOrEqual(4.5);
      expect(cr).toBeCloseTo(EXPECTED[name].accent, 1);
    });

    it(`тема «${name}»: обе промежуточные пары ступеньки проваливают AA — переход обязан быть мгновенным (раздел 3, П2(б))`, () => {
      // --text (тёмная подпись) на --accent — то, что было бы видно на середине
      // кросс-фейда заливки без смены подписи.
      const crTextOnAccent = contrast(text, accent);
      expect(crTextOnAccent, `--text на --accent = ${crTextOnAccent.toFixed(2)}:1 — обязан быть ниже AA`).toBeLessThan(4.5);
      // --text-on-accent (светлая подпись) на --border — обратная половина
      // того же кросс-фейда.
      const crOnAccentOnBorder = contrast(textOnAccent, border);
      expect(crOnAccentOnBorder, `--text-on-accent на --border = ${crOnAccentOnBorder.toFixed(2)}:1 — обязан быть ниже AA`).toBeLessThan(4.5);
    });
  }
});

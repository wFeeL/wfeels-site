import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** Критерий 10 брифа `02-home-core.md`: «Контраст моно-подписей на --surface
 *  — AA, посчитан, а не оценён.» Моно-подписи внутри ядра (подпись шаблона,
 *  счёт, клеймо, легенда) красятся `--text-muted` (раздел 6 таблицы) на
 *  панели, которая всегда `--surface` (раздел 6: «панель — непрозрачная
 *  `--surface`»). Считаем контраст этой пары в обеих темах. */

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
  светлая: { selector: ':root {', surface: '#FFFFFF', textMuted: '#5B6675' },
  'тёмная по выбору': { selector: ':root[data-theme="dark"]', surface: '#141C2A', textMuted: '#93A0B4' },
} as const;

describe('ядро фабрики — контраст моно-подписей на панели (AA)', () => {
  for (const [name, t] of Object.entries(THEMES)) {
    it(`тема «${name}»: --text-muted на --surface ≥ AA (4.5:1)`, () => {
      // Токены читаются из tokens.css — не задублированы руками, расхождение
      // с реальным значением упадёт этим же тестом.
      const surface = hexToRgb(tokenHex(t.selector, '--surface'));
      const textMuted = hexToRgb(tokenHex(t.selector, '--text-muted'));
      expect(hexToRgb(t.surface)).toEqual(surface);
      expect(hexToRgb(t.textMuted)).toEqual(textMuted);

      const cr = contrast(surface, textMuted);
      // eslint-disable-next-line no-console
      console.log(`${name}: --text-muted ${t.textMuted} на --surface ${t.surface} → ${cr.toFixed(2)}:1`);
      expect(cr, `контраст ${cr.toFixed(2)}:1 ниже AA`).toBeGreaterThanOrEqual(4.5);
    });
  }
});

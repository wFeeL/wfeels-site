import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** Приёмка `02-background-line.md`, раздел 9, пункты 14–15 (пересчитано под
 *  D-043, штрих 8–10 px):
 *
 *  14. контраст штриха к `--bg` лежит в полосе 1,36…1,46:1 в обеих темах;
 *      `--text` над штрихом ≥ 4,5:1 в обеих темах (фактически 11,98/10,16);
 *  15. тест УТВЕРЖДАЕТ ПРОВАЛ `--text-muted` над штрихом в светлой теме
 *      (< 4,5:1) — не как допуск, а как зафиксированную причину правила 5.3
 *      («заход только над --text, никогда над --text-muted»). Если этот
 *      пункт однажды пройдёт, непрозрачность уехала вниз — и это тоже повод
 *      посмотреть, а не молча зазеленить тест. */

const TOKENS = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');

function opacityFromTokens(): number {
  // Раздел 5.2/7.4: цвет штриха — `stroke-opacity: var(--line-opacity)` на
  // самом пути, значение токена читаем из tokens.css (:root, база — токен
  // не переопределяется по теме, раздел 5.2: «одно значение на обе темы»).
  const start = TOKENS.indexOf(':root {');
  const open = TOKENS.indexOf('{', start);
  const close = TOKENS.indexOf('}', open);
  const block = TOKENS.slice(open, close);
  const m = /--line-opacity:\s*([\d.]+)/.exec(block);
  expect(m, 'в tokens.css :root нет --line-opacity').not.toBeNull();
  return Number(m![1]);
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
  светлая: { selector: ':root {', bg: '#F4F6F9', text: '#0F1620', textMuted: '#5B6675', accent: '#2F5BFF' },
  'тёмная по выбору': {
    selector: ':root[data-theme="dark"]', bg: '#0E1420', text: '#DCE3EE', textMuted: '#93A0B4', accent: '#5B84FF',
  },
} as const;

describe('линия на фоне — контраст (раздел 5, приёмка 9.14–9.15)', () => {
  const opacity = opacityFromTokens();

  it('непрозрачность штриха читается из tokens.css и равна 0.22…0.26 (раздел 5.2)', () => {
    expect(opacity).toBeGreaterThanOrEqual(0.22);
    expect(opacity).toBeLessThanOrEqual(0.26);
  });

  for (const [name, t] of Object.entries(THEMES)) {
    const bg = hexToRgb(tokenHex(t.selector, '--bg'));
    const text = hexToRgb(tokenHex(t.selector, '--text'));
    const textMuted = hexToRgb(tokenHex(t.selector, '--text-muted'));
    const accent = hexToRgb(tokenHex(t.selector, '--accent'));
    const blended = blendOverBg(accent, bg, opacity);

    it(`тема «${name}»: контраст штриха к --bg лежит в полосе 1,36…1,46:1`, () => {
      const cr = contrast(bg, blended);
      // eslint-disable-next-line no-console
      console.log(`${name}: opacity=${opacity} пиксель штриха ${blended.map((v) => Math.round(v))}, контраст к фону ${cr.toFixed(3)}:1`);
      expect(cr, `контраст штриха к фону ${cr.toFixed(3)}:1 вне полосы 1,36…1,46`).toBeGreaterThanOrEqual(1.36);
      expect(cr, `контраст штриха к фону ${cr.toFixed(3)}:1 вне полосы 1,36…1,46`).toBeLessThanOrEqual(1.46);
    });

    it(`тема «${name}»: контраст --text над штрихом ≥ AA (4.5:1)`, () => {
      const cr = contrast(text, blended);
      console.log(`${name}: контраст --text над штрихом ${cr.toFixed(2)}:1`);
      expect(cr, `контраст ${cr.toFixed(2)}:1 ниже AA`).toBeGreaterThanOrEqual(4.5);
    });

    if (name === 'светлая') {
      it('тема «светлая»: --text-muted над штрихом ПРОВАЛИВАЕТ AA — это причина правила 5.3, не допуск', () => {
        const cr = contrast(textMuted, blended);
        console.log(`${name}: контраст --text-muted над штрихом ${cr.toFixed(2)}:1 (ожидается провал)`);
        expect(
          cr,
          `--text-muted над штрихом внезапно прошёл AA (${cr.toFixed(2)}:1) — непрозрачность штриха уехала вниз, ` +
            'проверь --line-opacity и правило 5.3 (заход линии только над --text)',
        ).toBeLessThan(4.5);
      });
    }
  }
});

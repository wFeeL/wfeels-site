import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** Приёмка `05-line.md`, раздел 5.2/5.3 и раздел 11, пункты 14–15.
 *  ПЕРЕПИСАНО под шаг 5 плана (раздел 10): толщина линии выросла до
 *  31…48 px (раздел 5.1, `stroke-width: 34` в `BackgroundLine.astro`),
 *  и та же непрозрачность на вчетверо большей площади даёт не разделитель,
 *  а плашку — поэтому `--line-opacity` расщепился на ДВА значения по
 *  теме, действующих только от 900 px (`tokens.css`, блок
 *  `@media (min-width: 900px)` в конце файла). Ниже 900 px линия — прямая
 *  нитка в поле, под текст не заходит, и там остаётся прежнее 0.24 в
 *  обеих темах — этот файл проверяет обе полосы (базовую и ≥ 900 px).
 *
 *  14. контраст штриха к `--bg` лежит в полосе 1,15…1,20:1 светлая /
 *      1,20…1,28:1 тёмная (обе темы ≥ 900 px);
 *  15. `--text` и `--text-muted` над штрихом ≥ 4,5:1 в ОБЕИХ темах — это
 *      и есть перемена смысла относительно прежней версии теста: при
 *      непрозрачности 0.24 `--text-muted` в светлой теме проваливал AA
 *      (3,85:1) и это было зафиксированным провалом; при 0.13 запас над
 *      порогом почти нулевой (4,51:1 при 4,50) и тест обязан ловить его
 *      уход — доказано ниже прямым расчётом на границе 0.14 (раздел 5.3:
 *      «запас под --text-muted в светлой теме — 4,51 при пороге 4,50,
 *      то есть его практически нет»). */

const TOKENS = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');

/** Базовое (<900 px) значение — читается из первого блока `:root { ... }`,
 *  не тронуто этим шагом: обе темы делят одно число, 0.24. */
function baseOpacityFromTokens(): number {
  const start = TOKENS.indexOf(':root {');
  const open = TOKENS.indexOf('{', start);
  const close = TOKENS.indexOf('}', open);
  const block = TOKENS.slice(open, close);
  const m = /--line-opacity:\s*([\d.]+)/.exec(block);
  expect(m, 'в базовом :root нет --line-opacity').not.toBeNull();
  return Number(m![1]);
}

/** Значения ≥ 900 px — читаются из хвостового блока
 *  `@media (min-width: 900px) { ... }` (раздел 5.2), по трём селекторам:
 *  светлая (`:root:not([data-theme="dark"])`), тёмная по системе
 *  (`:root:not([data-theme="light"])`, вложенный `prefers-color-scheme`),
 *  тёмная принудительно (`:root[data-theme="dark"]`). Читаем именно
 *  хвостовой блок (индекс маркера), а не файл целиком — иначе регэксп
 *  находит одноимённые селекторы из более ранних блоков темы, у которых
 *  `--line-opacity` не задан вовсе, и падает на пустом совпадении. */
function widthGatedOpacity(): { light: number; darkSystem: number; darkForced: number } {
  const marker = '@media (min-width: 900px)';
  const tailStart = TOKENS.indexOf(marker);
  expect(tailStart, `в tokens.css нет блока «${marker}»`).toBeGreaterThan(-1);
  const tail = TOKENS.slice(tailStart);

  function extract(re: RegExp, label: string): number {
    const m = re.exec(tail);
    expect(m, `в блоке ≥900px не найден «${label}»`).not.toBeNull();
    return Number(m![1]);
  }

  return {
    light: extract(/:root:not\(\[data-theme="dark"\]\)\s*\{\s*--line-opacity:\s*([\d.]+)/, 'светлая (:not([data-theme="dark"]))'),
    darkSystem: extract(/:root:not\(\[data-theme="light"\]\)\s*\{\s*--line-opacity:\s*([\d.]+)/, 'тёмная по системе (:not([data-theme="light"]))'),
    darkForced: extract(/:root\[data-theme="dark"\]\s*\{\s*--line-opacity:\s*([\d.]+)/, 'тёмная принудительно ([data-theme="dark"])'),
  };
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

describe('линия на фоне — контраст (раздел 5, приёмка 11.14–11.15)', () => {
  const base = baseOpacityFromTokens();
  const above900 = widthGatedOpacity();

  it('базовая (<900 px) непрозрачность не тронута этим шагом и равна 0.22…0.26 в обеих темах', () => {
    expect(base).toBeGreaterThanOrEqual(0.22);
    expect(base).toBeLessThanOrEqual(0.26);
  });

  it('тёмная тема ≥900px: системная и принудительная сходятся к одному числу', () => {
    expect(above900.darkSystem).toBe(above900.darkForced);
  });

  const OPACITY_BY_THEME: Record<keyof typeof THEMES, number> = {
    светлая: above900.light,
    'тёмная по выбору': above900.darkForced,
  };

  for (const [name, t] of Object.entries(THEMES) as [keyof typeof THEMES, (typeof THEMES)[keyof typeof THEMES]][]) {
    const bg = hexToRgb(tokenHex(t.selector, '--bg'));
    const text = hexToRgb(tokenHex(t.selector, '--text'));
    const textMuted = hexToRgb(tokenHex(t.selector, '--text-muted'));
    const accent = hexToRgb(tokenHex(t.selector, '--accent'));
    const opacity = OPACITY_BY_THEME[name];
    const bandLo = name === 'светлая' ? 1.15 : 1.20;
    const bandHi = name === 'светлая' ? 1.20 : 1.28;

    it(`тема «${name}»: --line-opacity ≥900px читается из tokens.css`, () => {
      // eslint-disable-next-line no-console
      console.log(`${name}: --line-opacity (≥900px) = ${opacity}`);
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThan(base);
    });

    it(`тема «${name}»: контраст штриха к --bg лежит в полосе ${bandLo}…${bandHi}:1`, () => {
      const blended = blendOverBg(accent, bg, opacity);
      const cr = contrast(bg, blended);
      console.log(`${name}: opacity=${opacity} пиксель штриха ${blended.map((v) => Math.round(v))}, контраст к фону ${cr.toFixed(3)}:1`);
      expect(cr, `контраст штриха к фону ${cr.toFixed(3)}:1 вне полосы ${bandLo}…${bandHi}`).toBeGreaterThanOrEqual(bandLo);
      expect(cr, `контраст штриха к фону ${cr.toFixed(3)}:1 вне полосы ${bandLo}…${bandHi}`).toBeLessThanOrEqual(bandHi);
    });

    it(`тема «${name}»: контраст --text над штрихом ≥ AA (4.5:1)`, () => {
      const blended = blendOverBg(accent, bg, opacity);
      const cr = contrast(text, blended);
      console.log(`${name}: контраст --text над штрихом ${cr.toFixed(2)}:1`);
      expect(cr, `контраст ${cr.toFixed(2)}:1 ниже AA`).toBeGreaterThanOrEqual(4.5);
    });

    it(`тема «${name}»: контраст --text-muted над штрихом ≥ AA (4.5:1) — раздел 5.3, заход теперь разрешён`, () => {
      const blended = blendOverBg(accent, bg, opacity);
      const cr = contrast(textMuted, blended);
      console.log(`${name}: контраст --text-muted над штрихом ${cr.toFixed(3)}:1`);
      expect(cr, `--text-muted над штрихом провалил AA (${cr.toFixed(3)}:1) — заход линии под текст (5.3) требует ≥ 4,5`).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('светлая тема: запас под --text-muted почти нулевой — на 0.14 AA УЖЕ проваливается (раздел 5.3, 11.14)', () => {
    const t = THEMES['светлая'];
    const bg = hexToRgb(tokenHex(t.selector, '--bg'));
    const textMuted = hexToRgb(tokenHex(t.selector, '--text-muted'));
    const accent = hexToRgb(tokenHex(t.selector, '--accent'));

    const at013 = contrast(textMuted, blendOverBg(accent, bg, 0.13));
    const at014 = contrast(textMuted, blendOverBg(accent, bg, 0.14));
    console.log(`светлая: --text-muted над штрихом при 0.13 = ${at013.toFixed(3)}:1, при 0.14 = ${at014.toFixed(3)}:1`);

    // Фактическое значение токена обязано быть по эту сторону границы.
    expect(at013).toBeGreaterThanOrEqual(4.5);
    // А граница действительно нулевая: 0.14 в этой же формуле уже красный.
    expect(at014).toBeLessThan(4.5);
  });
});

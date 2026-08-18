import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const CSS = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

/** Блоки токенов: светлая база и обе тёмные ветки. Тёмных две, и разойтись они
 *  могут молча — одну правят, вторую забывают. */
const BLOCKS = {
  светлая: ':root {',
  'тёмная по выбору': ':root[data-theme="dark"]',
  'тёмная по системе': ':root:not([data-theme="light"])',
} as const;

/** Значение токена внутри блока, начинающегося с этого селектора. */
function token(selector: string, name: string): string {
  const start = CSS.indexOf(selector);
  expect(start, `в tokens.css нет блока ${selector}`).toBeGreaterThan(-1);
  const open = CSS.indexOf('{', start);
  const close = CSS.indexOf('}', open);
  const found = new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(CSS.slice(open, close));
  expect(found, `в блоке ${selector} нет ${name}`).not.toBeNull();
  return found![1].toUpperCase();
}

/** Относительная яркость по WCAG 2.1, формула 1.4.3. */
function luminance(hex: string): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('--danger', () => {
  // Служебный цвет состояния: им помечено обязательное поле, им же будут
  // показаны ошибки. Он обязан существовать в КАЖДОЙ теме — иначе в одной из
  // них звёздочка молча вернётся к цвету подписи, и обязательность поля
  // перестанет быть видна.
  for (const [name, selector] of Object.entries(BLOCKS)) {
    it(`объявлен в теме «${name}»`, () => {
      expect(token(selector, '--danger')).toMatch(/^#[0-9A-F]{6}$/);
    });
  }

  // Один красный на обе темы читаемым быть не может: на белой карточке нужен
  // тёмный, на #0E1420 — светлый. Поэтому значений два, и проверяются оба —
  // против фона страницы И против поверхности карточки, потому что форма стоит
  // и там, и там.
  it.each([
    ['светлая', ':root {', ['#F4F6F9', '#FFFFFF']],
    ['тёмная по выбору', ':root[data-theme="dark"]', ['#0E1420', '#141C2A']],
    ['тёмная по системе', ':root:not([data-theme="light"])', ['#0E1420', '#141C2A']],
  ] as const)('в теме «%s» проходит AA на фоне и на карточке', (_, selector, grounds) => {
    const danger = token(selector, '--danger');
    for (const ground of grounds) {
      expect(
        contrast(danger, ground),
        `${danger} на ${ground} — ниже AA (4.5:1)`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('не совпадает с акцентом: это другой смысл, а не оттенок бренда', () => {
    for (const selector of Object.values(BLOCKS)) {
      expect(token(selector, '--danger')).not.toBe(token(selector, '--accent'));
    }
  });
});

/** Значение произвольного (не hex-цветового) токена внутри блока темы —
 *  ширины штриха записаны в `px`, непрозрачность — безразмерным числом. */
function tokenRaw(selector: string, name: string): string {
  const start = CSS.indexOf(selector);
  expect(start, `в tokens.css нет блока ${selector}`).toBeGreaterThan(-1);
  const open = CSS.indexOf('{', start);
  const close = CSS.indexOf('}', open);
  const found = new RegExp(`${name}:\\s*([^;]+);`).exec(CSS.slice(open, close));
  expect(found, `в блоке ${selector} нет ${name}`).not.toBeNull();
  return found![1].trim();
}

// Задача 18 (правка 2026-08-19): плейсхолдеры полей формы (`Field.astro`,
// `input::placeholder`/`textarea::placeholder`) набраны `--text-muted` по
// `--surface` (фон самого поля, не страницы) — считается отдельно, потому
// что браузерный дефолт плейсхолдера обычно ниже AA, а «на глаз» это не
// проверить: цвет один и тот же токен, но фон другой, чем у `--danger` выше.
describe('плейсхолдер поля (--text-muted на --surface)', () => {
  it.each([
    ['светлая', ':root {'],
    ['тёмная по выбору', ':root[data-theme="dark"]'],
    ['тёмная по системе', ':root:not([data-theme="light"])'],
  ] as const)('в теме «%s» проходит AA на фоне поля', (_, selector) => {
    const muted = token(selector, '--text-muted');
    const surface = token(selector, '--surface');
    expect(
      contrast(muted, surface),
      `${muted} на ${surface} — ниже AA (4.5:1)`,
    ).toBeGreaterThanOrEqual(4.5);
  });
});

describe('токены обводки ядра фабрики (02-home-core.md, раздел 8)', () => {
  // Общесистемные — заведены задачей 14, ими пользуется вычерченное ядро
  // тизера фабрики, а позже и линия фона, и схемы на посадочных.
  it('--stroke-hair — 1px', () => {
    expect(tokenRaw(':root {', '--stroke-hair')).toBe('1px');
  });
  it('--stroke-line — 1.5px', () => {
    expect(tokenRaw(':root {', '--stroke-line')).toBe('1.5px');
  });
  it('--stroke-bold — 2px', () => {
    expect(tokenRaw(':root {', '--stroke-bold')).toBe('2px');
  });

  // Непрозрачность волосяной линии — две величины намеренно: одна не
  // различима одинаково на #F4F6F9 и на #0E1420, проверено рендером.
  it.each([
    ['светлая', ':root {', '0.45'],
    ['тёмная по выбору', ':root[data-theme="dark"]', '0.6'],
    ['тёмная по системе', ':root:not([data-theme="light"])', '0.6'],
  ] as const)('--stroke-hair-opacity в теме «%s» равна %s', (_, selector, expected) => {
    expect(tokenRaw(selector, '--stroke-hair-opacity')).toBe(expected);
  });
});

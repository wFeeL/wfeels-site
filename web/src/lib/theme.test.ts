import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { THEME_COLOR } from './theme';

/** Значение `--bg` из блока токенов, начинающегося с этого селектора. */
function background(selector: string): string {
  const css = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8');
  const start = css.indexOf(selector);
  expect(start, `в tokens.css нет блока ${selector}`).toBeGreaterThan(-1);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const found = /--bg:\s*(#[0-9A-Fa-f]{6})/.exec(css.slice(open, close));
  expect(found, `в блоке ${selector} нет --bg`).not.toBeNull();
  return found![1].toUpperCase();
}

describe('THEME_COLOR', () => {
  // Цвет верхней полосы браузера объявляется в <meta>, а туда CSS-переменная не
  // доходит: значение приходится писать литералом. Литерал — вторая копия
  // токена, и разойтись с ним он может молча. Тест читает сам файл токенов,
  // поэтому копия обязана оставаться копией.
  it('светлая совпадает с --bg светлой темы', () => {
    expect(THEME_COLOR.light.toUpperCase()).toBe(background(':root {'));
  });

  it('тёмная совпадает с --bg тёмной темы', () => {
    expect(THEME_COLOR.dark.toUpperCase()).toBe(background(':root[data-theme="dark"]'));
  });

  it('тёмная совпадает и с системной тёмной веткой', () => {
    expect(THEME_COLOR.dark.toUpperCase())
      .toBe(background(':root:not([data-theme="light"])'));
  });
});

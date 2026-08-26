import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** Приёмка `70-workshop/specs/site-v3/11-line-narrator-brief.md`, раздел 3,
 *  П2(в): пять обязательных условий правила кнопки первого экрана. CSS
 *  собирается в JS-строке фронтматтера (`drawingSupportsCss`), а не в
 *  литеральном `<style>`, поэтому его нельзя прочитать регэкспом по
 *  `<style>…</style>` (так уже устроен
 *  `css-no-animation-shorthand-with-timeline.test.ts`) — правило читается
 *  из исходного текста файла напрямую. Это дешёвая структурная проверка ДО
 *  сборки; фактическое поведение в браузере (ступенька цвета, обе стороны,
 *  запасные режимы) проверяет `e2e/background-line-narrator.spec.ts`. */

const SOURCE = readFileSync(
  new URL('./BackgroundLine.astro', import.meta.url),
  'utf8',
);

describe('BackgroundLine.astro — кнопка первого экрана (раздел 3, П2)', () => {
  it('правило адресное — #hero .cta .btn.primary, не общий .btn.primary', () => {
    expect(SOURCE).toContain('#hero .cta .btn.primary{');
  });

  it('живёт внутри @media (min-width:900px) — ниже 900 px рассказа нет', () => {
    const idx = SOURCE.indexOf('#hero .cta .btn.primary{');
    const before = SOURCE.slice(0, idx);
    const lastMediaOpen = before.lastIndexOf('@media (min-width:900px){');
    expect(lastMediaOpen, 'правило кнопки не найдено внутри @media (min-width:900px)').toBeGreaterThan(-1);
  });

  it('базовое состояние — --border/--text, не результат кадра `from` (fill-mode: forwards, не both)', () => {
    const idx = SOURCE.indexOf('#hero .cta .btn.primary{');
    const block = SOURCE.slice(idx, SOURCE.indexOf('}', idx));
    expect(block).toContain('background-color:var(--border)');
    expect(block).toContain('color:var(--text)');
    expect(block).toContain('animation-fill-mode:forwards');
    expect(block).not.toContain('animation-fill-mode:both');
  });

  it('ступенька, не плавный переход: steps(1,jump-end), не linear и не var(--ease)', () => {
    const idx = SOURCE.indexOf('#hero .cta .btn.primary{');
    const block = SOURCE.slice(idx, SOURCE.indexOf('}', idx));
    expect(block).toContain('animation-timing-function:steps(1,jump-end)');
  });

  it('шкала — своя (безымянная view()) на самой кнопке, не именованная --line-progress секции', () => {
    const idx = SOURCE.indexOf('#hero .cta .btn.primary{');
    const block = SOURCE.slice(idx, SOURCE.indexOf('}', idx));
    expect(block).toContain('animation-timeline:view()');
    expect(block).not.toContain('--line-progress');
  });

  it('диапазон — то же единственное правило, что у шторки (--line-lead/--line-trail)', () => {
    const idx = SOURCE.indexOf('#hero .cta .btn.primary{');
    const block = SOURCE.slice(idx, SOURCE.indexOf('}', idx));
    expect(block).toContain(
      'animation-range:cover var(--line-lead) cover calc(100% - var(--line-trail))',
    );
  });

  it('@keyframes hero-cta-ignite объявлен статически и не назначает himself вне @supports', () => {
    expect(SOURCE).toMatch(/@keyframes hero-cta-ignite\s*\{/);
    // Объявление кадров — вне <style set:html> (в статическом <style is:global>),
    // а animation-name на кнопку назначается ТОЛЬКО в компактной drawingSupportsCss.
    const keyframesIdx = SOURCE.indexOf('@keyframes hero-cta-ignite');
    const drawingCssIdx = SOURCE.indexOf('const drawingSupportsCss');
    expect(keyframesIdx, '@keyframes hero-cta-ignite обязан быть в файле').toBeGreaterThan(-1);
    expect(drawingCssIdx, 'drawingSupportsCss обязан быть в файле').toBeGreaterThan(-1);
    expect(keyframesIdx).toBeGreaterThan(drawingCssIdx + 'const drawingSupportsCss'.length);
  });

  it('Button.astro не тронут этим правилом — здесь его нет ни строкой, .primary остаётся акцентной по умолчанию', () => {
    const buttonSource = readFileSync(
      new URL('./Button.astro', import.meta.url),
      'utf8',
    );
    expect(buttonSource).not.toContain('hero-cta-ignite');
    expect(buttonSource).not.toContain('animation-timeline');
    expect(buttonSource).toContain('.primary { background: var(--accent); color: var(--text-on-accent); }');
  });
});

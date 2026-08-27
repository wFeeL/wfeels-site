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

  it('базовое состояние — --border/--text, статическое, БЕЗ анимации (диагноз стоимости отрисовки: перекраска самой кнопки стоила 880–1046 `Paint` за 60 тиков колеса, порог сторожа 320)', () => {
    const idx = SOURCE.indexOf('#hero .cta .btn.primary{');
    const block = SOURCE.slice(idx, SOURCE.indexOf('}', idx));
    expect(block).toContain('background-color:var(--border)');
    expect(block).toContain('color:var(--text)');
    expect(block, 'кнопка не обязана нести ни одного anim-свойства — ступеньку рисует слой .cta-ignite-overlay').not.toContain('animation');
  });

  it('правило адресное — #hero .cta .cta-ignite-step, пять декоративных слоёв-дубликатов лестницы, а не сама кнопка', () => {
    expect(SOURCE).toContain('#hero .cta .cta-ignite-step{');
  });

  it('общий блок лестницы живёт в той же @media (min-width:900px), сразу после блока кнопки', () => {
    const btnIdx = SOURCE.indexOf('#hero .cta .btn.primary{');
    const stepIdx = SOURCE.indexOf('#hero .cta .cta-ignite-step{');
    expect(stepIdx, 'общий блок лестницы обязан идти после блока кнопки').toBeGreaterThan(btnIdx);
    const between = SOURCE.slice(SOURCE.indexOf('}', btnIdx) + 1, stepIdx);
    expect(between, 'между блоком кнопки и общим блоком лестницы не должно быть закрытия @media').not.toContain('}');
  });

  it('fill-mode: forwards, не both — ступеньку несёт каждый слой, не сама кнопка', () => {
    const idx = SOURCE.indexOf('#hero .cta .cta-ignite-step{');
    const block = SOURCE.slice(idx, SOURCE.indexOf('}', idx));
    expect(block).toContain('animation-fill-mode:forwards');
    expect(block).not.toContain('animation-fill-mode:both');
  });

  it('ступенька, не плавный переход: steps(1,jump-end), не linear и не var(--ease)', () => {
    const idx = SOURCE.indexOf('#hero .cta .cta-ignite-step{');
    const block = SOURCE.slice(idx, SOURCE.indexOf('}', idx));
    expect(block).toContain('animation-timing-function:steps(1,jump-end)');
  });

  it('шкала — своя (безымянная view()) на коробке слоя, не именованная --line-progress секции', () => {
    const idx = SOURCE.indexOf('#hero .cta .cta-ignite-step{');
    const block = SOURCE.slice(idx, SOURCE.indexOf('}', idx));
    expect(block).toContain('animation-timeline:view()');
    expect(block).not.toContain('--line-progress');
  });

  it('пять порогов лестницы (раздел 10.6, Р-3): пятый совпадает со старым единственным, 1…4 сдвинуты раньше на (N−i)·8,8px', () => {
    const steps: [number, string][] = [
      [1, 'calc(100% - var(--line-trail) - 35.2px)'],
      [2, 'calc(100% - var(--line-trail) - 26.4px)'],
      [3, 'calc(100% - var(--line-trail) - 17.6px)'],
      [4, 'calc(100% - var(--line-trail) - 8.8px)'],
      [5, 'calc(100% - var(--line-trail))'],
    ];
    for (const [step, endExpr] of steps) {
      const idx = SOURCE.indexOf(`#hero .cta .cta-ignite-step[data-step="${step}"]{`);
      expect(idx, `правило для data-step="${step}" не найдено`).toBeGreaterThan(-1);
      const block = SOURCE.slice(idx, SOURCE.indexOf('}', idx));
      expect(block, `data-step="${step}": animation-range обязан кончаться на ${endExpr}`).toContain(
        `animation-range:cover var(--line-lead) cover ${endExpr}`,
      );
    }
  });

  it('кадры ступеньки — opacity 0→1 (композитное свойство), не background-color/color', () => {
    const idx = SOURCE.indexOf('@keyframes hero-cta-ignite');
    const block = SOURCE.slice(idx, SOURCE.indexOf('}\n  }', idx) + 1);
    expect(block).toContain('opacity: 0');
    expect(block).toContain('opacity: 1');
    expect(block, 'некомпозитные background-color/color не должны вернуться в кадры').not.toContain('background-color');
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

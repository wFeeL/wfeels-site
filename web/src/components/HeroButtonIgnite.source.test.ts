import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const SOURCE = readFileSync(new URL('./BackgroundLine.astro', import.meta.url), 'utf8');
const HERO_SOURCE = readFileSync(new URL('./home/Hero.astro', import.meta.url), 'utf8');
const SQUASHED = SOURCE.replace(/\s+/g, '');

describe('BackgroundLine.astro — плавное заполнение CTA первого экрана', () => {
  it('настоящая кнопка остаётся статической и серой до прихода линии', () => {
    const idx = SQUASHED.indexOf('#hero.cta.btn.primary{');
    expect(idx).toBeGreaterThan(-1);
    const block = SQUASHED.slice(idx, SQUASHED.indexOf('}', idx));
    expect(block).toContain('background-color:var(--border)');
    expect(block).toContain('color:var(--text)');
    expect(block).not.toContain('animation');
  });

  it('рисуется один декоративный полноразмерный слой вместо пяти ступеней', () => {
    expect(HERO_SOURCE).toContain('class="cta-ignite-fill"');
    expect(HERO_SOURCE).not.toContain('cta-ignite-step');
    expect(HERO_SOURCE).not.toContain('CTA_IGNITE_STEPS');
  });

  it('акцентный слой анимирует translate с мягким easing на собственной view-шкале', () => {
    const idx = SQUASHED.indexOf('#hero.cta.cta-ignite-fill{');
    expect(idx).toBeGreaterThan(-1);
    const block = SQUASHED.slice(idx, SQUASHED.indexOf('}', idx));
    expect(block).toContain('opacity:1');
    expect(block).toContain('animation-timing-function:cubic-bezier(.65,0,.35,1)');
    expect(block).toContain('animation-fill-mode:both');
    expect(block).toContain('animation-timeline:view()');
    expect(block).toContain('animation-range:covercalc(100vh-var(--line-head))covercalc(100%-var(--line-head)+96px)');
    expect(block).not.toContain('steps(');
  });

  it('акцентный слой и подпись движутся навстречу без paint-тяжёлой маски', () => {
    const idx = SOURCE.indexOf('@keyframes hero-cta-ignite');
    const block = SOURCE.slice(idx, SOURCE.indexOf('\n  }', idx) + 4);
    expect(block).toContain('translate: -100% 0');
    expect(block).toContain('translate: 0 0');
    expect(block).not.toContain('background-color');
    expect(block).not.toContain('color:');
    expect(block).not.toContain('opacity:');

    const labelIdx = SOURCE.indexOf('@keyframes hero-cta-label-lock');
    const labelBlock = SOURCE.slice(labelIdx, SOURCE.indexOf('\n  }', labelIdx) + 4);
    expect(labelBlock).toContain('translate: 100% 0');
    expect(labelBlock).toContain('translate: 0 0');
    const labelRuleIdx = SQUASHED.indexOf('#hero.cta.cta-ignite-label{');
    const labelRule = SQUASHED.slice(labelRuleIdx, SQUASHED.indexOf('}', labelRuleIdx));
    expect(labelRule).toContain('animation-timing-function:cubic-bezier(.65,0,.35,1)');
    expect(SOURCE).not.toContain('clip-path: inset(0 100% 0 0)');
  });

  it('анимация объявлена ровно один раз и не меняет общий Button', () => {
    const first = SOURCE.indexOf('@keyframes hero-cta-ignite');
    expect(first).toBeGreaterThan(-1);
    expect(SOURCE.indexOf('@keyframes hero-cta-ignite', first + 1)).toBe(-1);

    const buttonSource = readFileSync(new URL('./Button.astro', import.meta.url), 'utf8');
    expect(buttonSource).not.toContain('hero-cta-ignite');
    expect(buttonSource).not.toContain('animation-timeline');
    expect(buttonSource).toContain('.primary { background: var(--accent); color: var(--text-on-accent); }');
  });
});

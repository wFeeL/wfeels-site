import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const css = readdirSync(resolve(dist, '_astro'))
  .filter((file) => file.endsWith('.css'))
  .map((file) => readFileSync(resolve(dist, '_astro', file), 'utf8'))
  .join('\n');
const html = readFileSync(resolve(dist, 'index.html'), 'utf8');

describe('dist — выбранные deco-фичи', () => {
  it('Ф-7 и Ф-8 присутствуют и уважают reduced motion', () => {
    expect(css).toContain('hero-draw');
    expect(css).toMatch(/prefers-reduced-motion\s*:\s*no-preference[^{]*\{[^}]*@view-transition/);
    expect(css.match(/view-transition-name:/g)).toHaveLength(2);
  });

  it('из Ф-10 взята только пустая статичная ось', () => {
    expect(html).toMatch(/<span class="rail-axis" aria-hidden="true"[^>]*><\/span>/);
    expect(css).not.toContain('rail-fill');
    expect(css).not.toContain('rail-axis>i');
  });
});

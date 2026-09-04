import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const PROCESS_ASTRO = readFileSync(new URL('../components/home/Process.astro', import.meta.url), 'utf8');

describe('цифры процесса зажигаются без наложенного дубликата', () => {
  it('не создаёт второй глиф через data-num или .num::after', () => {
    expect(PROCESS_ASTRO).not.toContain('data-num=');
    expect(PROCESS_ASTRO).not.toMatch(/\.num::after\s*\{/);
  });

  it('плавно смешивает цвет самой цифры на диапазоне 128 px', () => {
    const numRule = /\.num\s*\{([^]*?)animation-range:([^;]+);/m.exec(PROCESS_ASTRO);
    expect(numRule).not.toBeNull();
    expect(numRule![1]).toContain('animation-timing-function: cubic-bezier(.65, 0, .35, 1)');
    expect(numRule![1]).not.toContain('steps(');
    expect(numRule![1]).toContain('animation-fill-mode: both');
    expect(numRule![2]).toContain('var(--line-head) + 20px');
    expect(numRule![2]).toContain('var(--line-head) + 148px');

    const keyframes = /@keyframes\s+num-ignite\s*\{([^]*?)\n\s*\}/.exec(PROCESS_ASTRO);
    expect(keyframes).not.toBeNull();
    expect(keyframes![1]).toContain('color: var(--text-muted)');
    expect(keyframes![1]).toContain('color: var(--accent)');
    expect(keyframes![1]).not.toContain('opacity');
  });

  it('старая плашка-подчёркивание не вернулась', () => {
    expect(PROCESS_ASTRO).not.toContain('process-num-underline');
  });
});

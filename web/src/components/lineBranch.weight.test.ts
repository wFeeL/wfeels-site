import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { LINE_STROKE_WIDTH_VB } from '../lib/linePaths';

/** Сторож П-Я1 — `70-workshop/specs/site-v3/15-line-through-scale-brief.md`,
 *  раздел 6.2/7: «на странице ровно ДВА веса нити (34 vb и 8 vb) и ровно
 *  ОДИН оттенок (`--accent` смешанный) в двух плотностях (13/17% и 45%)».
 *
 *  Находка рецензента, которую эта правка закрывает: было три веса и три
 *  оттенка на одном событии — основная полоса (34 vb, 13–17%), отвод
 *  (было 2 vb, 45%) и `.num::after` (2px CSS-фон, `var(--accent)` в чистую
 *  непрозрачность, третий инструмент). Разница между основной полосой и
 *  старым отводом была тридцатикратной («ветвь читается лидер-линией из
 *  чужого чертежа»). Стало — 34:8 ≈ 4:1, пара перьев одной руки.
 *
 *  Числа сверяются с исходником CSS тем же приёмом, что уже несёт
 *  `linePaths.contract.test.ts` для основной полосы (regex по `.line
 *  path{...}`), не второй копией чисел здесь. */

const BACKGROUND_LINE_CSS = readFileSync(
  new URL('./BackgroundLine.astro', import.meta.url),
  'utf8',
);

function strokeWidthOf(selector: RegExp): number {
  const match = BACKGROUND_LINE_CSS.match(selector);
  expect(match, `селектор ${selector} не найден в BackgroundLine.astro`).not.toBeNull();
  return Number(match![1]);
}

describe('П-Я1 — два веса нити, одна пара перьев (раздел 6.2 брифа `15-line-through-scale-brief.md`)', () => {
  it('основная полоса (`.line path`) несёт 34 vb — не тронута этой правкой', () => {
    const mainWidth = strokeWidthOf(/\.line path\s*\{[^}]*stroke-width:\s*([\d.]+);/s);
    expect(mainWidth).toBe(34);
    expect(mainWidth).toBe(LINE_STROKE_WIDTH_VB);
  });

  it('отвод (`.line-branch`) несёт 8 vb — было 2 vb, поднято разделом 6.2', () => {
    const branchWidth = strokeWidthOf(/\.line path\.line-branch\s*\{[^}]*stroke-width:\s*([\d.]+);/s);
    expect(branchWidth).toBe(8);
  });

  it('отношение основной полосы к отводу — 34:8 = 4,25:1, «пара перьев одной руки», не тридцать раз', () => {
    const mainWidth = strokeWidthOf(/\.line path\s*\{[^}]*stroke-width:\s*([\d.]+);/s);
    const branchWidth = strokeWidthOf(/\.line path\.line-branch\s*\{[^}]*stroke-width:\s*([\d.]+);/s);
    const ratio = mainWidth / branchWidth;
    // «≈4:1» раздела 6.2 брифа — полоса допуска даёт место фактическому
    // 4,25:1 (34/8), не требует ровно 4.
    expect(ratio, `отношение ${ratio.toFixed(2)}:1 обязано быть между 3,5:1 и 5:1 («пара перьев», не порядок величины)`).toBeGreaterThanOrEqual(3.5);
    expect(ratio).toBeLessThanOrEqual(5);
  });

  it('отвод несёт ту же плотность 45%, что уже проверена `lineBranch.contrast.test.ts` — не второй расчёт', () => {
    const match = BACKGROUND_LINE_CSS.match(/\.line path\.line-branch\s*\{[^}]*stroke-opacity:\s*([\d.]+);/s);
    expect(match, 'stroke-opacity ветви не найден').not.toBeNull();
    expect(Number(match![1])).toBe(0.45);
  });
});

describe('П-Я1 — третий инструмент снят (раздел 6.2 брифа): `.num::after` отсутствует в Process.astro', () => {
  const PROCESS_ASTRO = readFileSync(new URL('../components/home/Process.astro', import.meta.url), 'utf8');

  it('в исходнике нет CSS-правила `.num::after { ... }` (упоминание в комментарии — не правило)', () => {
    expect(/\.num::after\s*\{/.test(PROCESS_ASTRO)).toBe(false);
  });

  it('в исходнике нет ключевого кадра `process-num-underline`, оставшегося от снятой плашки', () => {
    expect(PROCESS_ASTRO.includes('process-num-underline')).toBe(false);
  });
});

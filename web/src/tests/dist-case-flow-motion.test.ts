import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* Критерии приёмки движения иллюстрации «Заявка-Хаб» (бриф
 * `70-workshop/specs/site-v3/07-flow-motion-brief.md`, раздел 15), которые
 * проверяются БЕЗ браузера: порядок отрисовки (10), один пакет на раскрой
 * (12), отсутствие второго цвета (8) и осмысленность сюжета с любого места
 * входа (9).
 *
 * Раскадровка читается из САМОГО компонента — списка процентов в
 * `@keyframes hero-a` / `hero-b`, — а не переписывается сюда числами: копия
 * раскадровки разошлась бы с CSS при первой же правке и продолжала бы
 * зеленеть. Проверяется то, что реально поедет в браузере.
 *
 * Часть набора требует `npm run build`: критерии 10 и 12 читают готовый
 * `dist/index.html`, потому что порядок потомков — свойство ВЫВОДА, а не
 * исходника (условные ветки и слоты могли бы его переставить).
 */

const DIST_INDEX = fileURLToPath(new URL('../../dist/index.html', import.meta.url));
const COMPONENT = fileURLToPath(new URL('../components/home/CaseFlowIllustration.astro', import.meta.url));

const source = readFileSync(COMPONENT, 'utf8');

/** Шаги (границы фаз) одного набора ключевых кадров, в процентах периода. */
function keyframeSteps(name: string): number[] {
  const start = source.indexOf(`@keyframes ${name} {`);
  if (start < 0) throw new Error(`@keyframes ${name} не найден в компоненте`);
  const end = source.indexOf('\n  }', start);
  const body = source.slice(start, end);
  const steps = [...body.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]));
  return [...new Set(steps)].sort((a, b) => a - b);
}

/** Сколько границ фаз пересекает окно [from; from+span) на цикличной шкале. */
function boundariesInWindow(steps: readonly number[], from: number, span: number): number {
  const inner = steps.filter((s) => s > 0 && s < 100);
  let count = 0;
  for (const s of inner) {
    for (const shifted of [s, s + 100]) {
      if (shifted > from && shifted < from + span) count += 1;
    }
  }
  // Ноль/сто — одна и та же граница цикла (конец повтора → начало прихода).
  if (from > 0 && from + span > 100) count += 1;
  return count;
}

describe('«Заявка-Хаб» — раскадровка (бриф 07, раздел 7)', () => {
  for (const [layout, name, pause] of [
    ['А', 'hero-a', [55, 63]],
    ['Б', 'hero-b', [65, 73]],
  ] as const) {
    const steps = keyframeSteps(name);

    it(`раскрой ${layout}: ровно шестнадцать шагов, от 0 % до 100 %`, () => {
      expect(steps.length, `шаги: ${steps.join(' ')}`).toBe(16);
      expect(steps[0]).toBe(0);
      expect(steps[steps.length - 1]).toBe(100);
    });

    it(`раскрой ${layout}: пауза отказа — ${pause[1] - pause[0]} % периода = 0,72 с (критерий 7)`, () => {
      // Оба процента обязаны стоять в наборе и делить ОДНО значение
      // `offset-distance` — иначе пакет во время паузы едет.
      const block = new RegExp(`${pause[0]}%,\\s*${pause[1]}%\\s*\\{\\s*offset-distance:\\s*var\\(--w10\\);`);
      expect(source, `${pause[0]}%, ${pause[1]}% не делят один кадр в ${name}`).toMatch(block);
      expect(((pause[1] - pause[0]) / 100) * 9).toBeCloseTo(0.72, 2);
    });

    it(`раскрой ${layout}: сюжет осмыслен с любого места входа — окно 33 % пересекает ≥ 2 границ фаз (критерий 9)`, () => {
      const worst: string[] = [];
      for (let from = 0; from < 100; from += 1) {
        const n = boundariesInWindow(steps, from, 33);
        if (n < 2) worst.push(`${from} % → ${n}`);
      }
      expect(worst, `окна, где читателю нечего понять: ${worst.join(', ')}`).toEqual([]);
    });
  }

  it('период и его единственная кривая — 9 с, linear, без ускорений (раздел 12)', () => {
    expect(source).toMatch(/animation-duration:\s*9s,\s*9s;/);
    expect(source).toMatch(/animation-timing-function:\s*linear,\s*linear;/);
    expect(source).toMatch(/animation-iteration-count:\s*infinite,\s*infinite;/);
  });

  it('затвор цикла — animation-play-state, а не content-visibility (раздел 9.5)', () => {
    expect(source).toMatch(/\.flow\.off \.pkt \{ animation-play-state: paused, paused; \}/);
    expect(source).toContain('data-case-flow');
    expect(source).toContain('IntersectionObserver');
    // Комментарии вычищаются: они САМИ объясняют, почему механизм не
    // `content-visibility`, и сторож ловил бы собственное объяснение.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code, 'content-visibility цикл вне окна НЕ останавливает (замер)').not.toContain('content-visibility');
  });

  it('отказ читается перекрытием, а не цветом: у пакета один цвет на весь цикл (критерий 8)', () => {
    expect(source, '`--danger` — цвет формы, не рисунка').not.toContain('--danger');
    expect(source).not.toContain('FAIL_COLOR');
    // Единственное объявление `fill` у пакета — акцент; второго цвета нет ни
    // в ключевых кадрах, ни в состояниях.
    const fills = [...source.matchAll(/\.pkt\s*\{[^}]*?fill:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(fills).toEqual(['var(--accent)']);
    for (const kf of ['hero-a', 'hero-b', 'hero-a-vis', 'hero-b-vis']) {
      const start = source.indexOf(`@keyframes ${kf} {`);
      const body = source.slice(start, source.indexOf('\n  }', start));
      expect(body, `${kf} красит пакет`).not.toMatch(/fill|color|stroke/);
    }
  });
});

describe('dist/index.html — порядок отрисовки и число пакетов (критерии 10 и 12)', () => {
  it('сборка существует (npm run build перед этим набором)', () => {
    if (!existsSync(DIST_INDEX)) {
      throw new Error(
        `\n${DIST_INDEX} не найден. Сначала выполни \`npm run build\` в web/, ` +
        'затем повтори `npm run test:unit`.',
      );
    }
    expect(true).toBe(true);
  });

  if (!existsSync(DIST_INDEX)) return;
  const html = readFileSync(DIST_INDEX, 'utf8');

  for (const layout of ['ra', 'rb'] as const) {
    const open = html.indexOf(`class="svg ${layout}"`);
    const svg = html.slice(open, html.indexOf('</svg>', open));

    it(`раскрой .${layout}: ровно один пакет (критерий 12)`, () => {
      expect(open, `<svg class="svg ${layout}"> не найден в сборке`).toBeGreaterThan(-1);
      expect((svg.match(/class="pkt"/g) || []).length).toBe(1);
    });

    it(`раскрой .${layout}: линии → пакет → плашки → подписи (критерий 10)`, () => {
      const at = (re: RegExp): number[] => [...svg.matchAll(re)].map((m) => m.index!);
      const lines = at(/<path class="[hl] d /g);
      const pkts = svg.indexOf('class="pkts');
      // Плашки — непрозрачные заливки `--bg`: узел «ЗАЯВКА» и квадраты каналов.
      const plates = [...at(/<rect class="b n d /g), ...at(/<path class="n f /g)];
      const texts = at(/<text\b/g);

      expect(lines.length, 'линий не нашлось — селектор устарел').toBeGreaterThan(3);
      expect(pkts, 'группа пакета не найдена').toBeGreaterThan(-1);
      expect(plates.length, 'плашек не нашлось — селектор устарел').toBe(2);
      expect(texts.length, 'подписей не нашлось — селектор устарел').toBeGreaterThan(3);

      expect(Math.max(...lines), 'линия нарисована ПОСЛЕ пакета').toBeLessThan(pkts);
      expect(
        Math.min(...plates),
        'плашка нарисована ДО пакета — пакет не всасывается в узел, «доставлено» не читается',
      ).toBeGreaterThan(pkts);
      expect(
        Math.min(...texts),
        'подпись нарисована ДО пакета — пакет мог бы лечь поверх текста',
      ).toBeGreaterThan(pkts);
    });
  }
});

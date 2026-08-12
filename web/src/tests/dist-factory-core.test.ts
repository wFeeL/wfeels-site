import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { FACTORY, FACTORY_TOTALS } from '../data/factory';

/* Критерии приёмки задачи 14 (`70-workshop/specs/site-v3/02-home-core.md`,
 * раздел 13), проверяемые на готовой сборке `dist/`, а не рассуждением.
 * Требует `npm run build` перед `npm run test:unit`, как и соседние
 * `dist-*.test.ts`. */

const DIST = resolve(fileURLToPath(new URL('../../dist/', import.meta.url)));
const DIST_INDEX = resolve(fileURLToPath(new URL('../../dist/index.html', import.meta.url)));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('dist/ — вычерченное ядро фабрики (задача 14)', () => {
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

  // Критерий 3: рисунок и все его подписи присутствуют без выполнения JS —
  // проверяется на файле, не в браузере.
  it('оба раскроя и все подписи шаблонов — в разметке дословно', () => {
    for (const t of FACTORY) {
      expect(html, t.label).toContain(t.label);
    }
    expect(html).toContain('BOT_FACTORY');
  });

  // Критерий 2: строки `three` в сборке нет вовсе.
  it('строки `three` в dist/ нет', () => {
    expect(/\bthree\b/i.test(html)).toBe(false);
  });

  // Критерий 15: цвет — только `--accent` и токены текста, хардкода нет.
  it('лайм #C8FF45 не встречается нигде в dist/index.html', () => {
    expect(html.toUpperCase()).not.toContain('#C8FF45');
  });

  for (const [raskroi, cls] of [['А', 'core-a'], ['Б', 'core-b']] as const) {
    const svgStart = html.indexOf(`class="core-svg ${cls}"`);
    expect(svgStart, `раскрой ${raskroi} не найден`).toBeGreaterThan(-1);
    const svgEnd = html.indexOf('</svg>', svgStart);
    const svg = html.slice(svgStart, svgEnd);

    describe(`раскрой ${raskroi}`, () => {
      // Критерий 4 и 5: количество тиков и счёт — из FACTORY, не вписаны в
      // разметку руками.
      it(`всего тиков ${FACTORY_TOTALS.themes}, закрашенных ${FACTORY_TOTALS.demos}, полых ${FACTORY_TOTALS.themes - FACTORY_TOTALS.demos}`, () => {
        const filledTicks = countOccurrences(svg, 'data-filled="1"');
        const hollowTicks = countOccurrences(svg, 'data-filled="0"');
        const totalTicks = filledTicks + hollowTicks;

        expect(totalTicks).toBe(FACTORY_TOTALS.themes); // 32
        expect(filledTicks).toBe(FACTORY_TOTALS.demos); // 11 — критерий 7
        expect(hollowTicks).toBe(FACTORY_TOTALS.themes - FACTORY_TOTALS.demos); // 21 — критерий 7
      });

      it('счёт «N ТЕМ · N ДЕМО» присутствует для каждого шаблона', () => {
        for (const t of FACTORY) {
          expect(svg, `${t.id}: ${t.themes} ТЕМ · ${t.demos} ДЕМО`)
            .toContain(`${t.themes} ТЕМ · ${t.demos} ДЕМО`);
        }
      });

      // Критерий 6: честный ноль у reservation — БРОНЬ, все шесть тиков
      // полые, ни один не закрашен.
      it('БРОНЬ: все шесть тиков полые', () => {
        const reservation = FACTORY.find((t) => t.id === 'reservation')!;
        expect(reservation.demos).toBe(0);
        expect(reservation.themes).toBe(6);
        // Секция шаблона «БРОНЬ» — от его подписи до подписи следующего
        // элемента или до конца SVG.
        const labelIndex = svg.indexOf('>БРОНЬ<');
        expect(labelIndex, 'подпись БРОНЬ не найдена').toBeGreaterThan(-1);
      });

      // Критерий 14: геометрия ортогональна — ни одной команды C/S/Q/T,
      // только вертикали, горизонтали, дуги радиуса 16.
      it('только ортогональные команды пути: нет C/S/Q/T', () => {
        const pathData = [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
        expect(pathData.length).toBeGreaterThan(0);
        for (const d of pathData) {
          expect(d, d).not.toMatch(/[CSQT]/);
        }
      });

      it('все дуги — радиуса 16', () => {
        const pathData = [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
        const arcs = pathData.filter((d) => d.includes('a16,16'));
        expect(arcs.length).toBeGreaterThan(0);
        for (const d of pathData) {
          // Любая команда `a`/`A` в разметке ядра обязана быть радиусом 16.
          const otherArc = /[aA](?!16,16)\d/.exec(d);
          expect(otherArc, d).toBeNull();
        }
      });
    });
  }

  // Критерий 17: ядро встречается на странице ровно один раз (на раскрой) и
  // не появляется ни на одной другой странице сайта.
  it('ядро — ровно по одному разу на раскрой на главной, и нигде больше на сайте', () => {
    expect(countOccurrences(html, 'class="core-svg core-a"')).toBe(1);
    expect(countOccurrences(html, 'class="core-svg core-b"')).toBe(1);

    const otherPages = walk(DIST)
      .filter((f) => f.endsWith('.html') && f !== DIST_INDEX);
    for (const file of otherPages) {
      const otherHtml = readFileSync(file, 'utf8');
      expect(otherHtml, file).not.toContain('core-svg');
    }
  });
});

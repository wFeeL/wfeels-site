import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { FACTORY, FACTORY_CAPTIONS, FACTORY_TOTALS } from '../data/factory';

/* Критерии приёмки брифа `04-cases-brief.md` (схема Ф-2 «Стеллаж», D-046),
 * проверяемые на готовой сборке `dist/`, а не рассуждением. Требует
 * `npm run build` перед `npm run test:unit`, как и соседние `dist-*.test.ts`.
 *
 * Заменяет `dist-factory-plate.test.ts` (снят вместе с плитой, D-048): часть
 * утверждений (число тем, честность формулировок, ловушка шорткода) — те же
 * по существу, применены к новой схеме. Одна разметка обслуживает оба
 * раскроя (переключение — только `@media`, раздел 6.5 брифа), поэтому
 * «отдельно для каждого раскроя» здесь означает «один и тот же счёт меток
 * верен на обеих ширинах», а не две копии в DOM.
 *
 * Классы несут префикс `cf-` и стили объявлены `is:global`
 * (`CaseFactoryIllustration.astro`) — экономия скоуп-атрибута Astro на ≈51
 * элементе схемы (раздел 16 брифа, потолок прироста веса). */

function resolvePath(rel: string): string {
  return fileURLToPath(new URL(rel, import.meta.url));
}

const DIST = resolve(resolvePath('../../dist/'));
const DIST_INDEX = resolvePath('../../dist/index.html');
const FACTORY_TEASER_FILE = resolvePath('../components/home/FactoryTeaser.astro');
const FACTORY_PLATE_FILE = resolvePath('../components/FactoryPlate.astro');

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('dist/ — «Стеллаж» (Ф-2, четвёртый кейс «Фабрика ботов»)', () => {
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

  // Критерий раздела 15 брифа, «components/FactoryCore.astro не существует»
  // у прежней схемы — тот же приём для обоих файлов, снятых D-048.
  it('components/home/FactoryTeaser.astro и components/FactoryPlate.astro не существуют', () => {
    expect(existsSync(FACTORY_TEASER_FILE)).toBe(false);
    expect(existsSync(FACTORY_PLATE_FILE)).toBe(false);
  });

  it('«Стеллаж» — ровно один раз на главной, и нигде больше на сайте', () => {
    expect(countOccurrences(html, 'class="cf-stellar"')).toBe(1);
  });

  it('число меток тем в разметке равно FACTORY_TOTALS.themes (32)', () => {
    const start = html.indexOf('class="cf-stellar"');
    const end = html.indexOf('</div></div>', html.lastIndexOf('class="cf-shelves"'));
    expect(start).toBeGreaterThan(-1);
    const block = html.slice(start, end === -1 ? undefined : end);
    expect(countOccurrences(block, 'class="cf-mark"')).toBe(FACTORY_TOTALS.themes);
  });

  it('число полок равно FACTORY.length, каждая подпись «ИМЯ · N ТЕМ» — дословно из данных', () => {
    const start = html.indexOf('class="cf-stellar"');
    const end = html.indexOf('class="cf-caption"', start);
    const block = html.slice(start, end);
    expect(countOccurrences(block, 'class="cf-shelf"')).toBe(FACTORY.length);
    for (const t of FACTORY) {
      expect(block, t.label).toContain(`>${t.label}<`);
      expect(block, `${t.themes} ${FACTORY_CAPTIONS.themes}`)
        .toContain(`${t.themes} ${FACTORY_CAPTIONS.themes}`);
    }
  });

  it('узел несёт подпись КАРКАС (капслок — только CSS, в разметке обычный регистр)', () => {
    expect(html).toContain(`>${FACTORY_CAPTIONS.node}<`);
  });

  it('подпись пучка — дословно `FACTORY_CAPTIONS.moves`, несущая конструкция честности (D-036)', () => {
    expect(html).toContain(`>${FACTORY_CAPTIONS.moves}<`);
  });

  it('запрещённые формулировки пучка («используется всеми», «общий для четырёх», «подключается») отсутствуют', () => {
    const start = html.indexOf('class="cf-stellar"');
    const end = html.indexOf('</div></div></div>', start) + '</div></div></div>'.length;
    const block = html.slice(start, end);
    for (const phrase of ['используется всеми', 'общий для четырёх', 'подключается']) {
      expect(block.toLowerCase(), phrase).not.toContain(phrase);
    }
    expect(/\bядр[а-яё]*\b/i.test(block), 'слово «ядро» встречается в рисунке').toBe(false);
  });

  it('рисунок неинтерактивен: role="img" с aria-label, визуальный слой — aria-hidden', () => {
    const idx = html.indexOf('class="cf-stellar" role="img"');
    expect(idx, 'role="img" не найден рядом с .cf-stellar').toBeGreaterThan(-1);
    const ariaLabelMatch = html.slice(idx, idx + 600).match(/aria-label="([^"]+)"/);
    expect(ariaLabelMatch, 'aria-label не найден').not.toBeNull();
    expect(ariaLabelMatch![1]).toContain(FACTORY_CAPTIONS.node);
    for (const t of FACTORY) {
      expect(ariaLabelMatch![1].toLowerCase()).toContain(t.label.toLowerCase());
    }
    expect(html.slice(idx, idx + 600)).toContain('class="cf-visual" aria-hidden="true"');
  });

  it('никакого <svg>, <img>, <canvas> внутри «Стеллажа»', () => {
    const start = html.indexOf('class="cf-stellar"');
    const end = html.indexOf('</div></div></div>', start) + '</div></div></div>'.length;
    const block = html.slice(start, end);
    expect(block).not.toMatch(/<svg\b/i);
    expect(block).not.toMatch(/<img\b/i);
    expect(block).not.toMatch(/<canvas\b/i);
  });

  // Ключевые кадры анимации (раздел 6.6 брифа) действительно попали в
  // собранный CSS — сама ловушка шорткода `animation:` рядом с
  // `animation-timeline` уже проверена по исходникам
  // `css-no-animation-shorthand-with-timeline.test.ts` (сканирует все
  // `*.astro`/`*.css`); здесь только факт присутствия в бандле.
  it('ключевые кадры трёх фаз («Стеллаж») присутствуют в собранном CSS', () => {
    const cssFiles = walk(join(DIST, '_astro')).filter((f) => f.endsWith('.css'));
    const css = cssFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const keyframe of ['cf-node-in', 'cf-line-x-in', 'cf-line-y-in', 'cf-marks-in']) {
      expect(css, `ключевой кадр ${keyframe} не найден в собранном CSS`).toContain(keyframe);
    }
  });
});

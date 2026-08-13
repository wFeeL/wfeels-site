import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { FACTORY, FACTORY_FRAME, FACTORY_CAPTIONS } from '../data/factory';

/* Критерии приёмки брифа `02-home-core.md` (вариант владельца А «Плита»,
 * раздел 13), проверяемые на готовой сборке `dist/`, а не рассуждением.
 * Требует `npm run build` перед `npm run test:unit`, как и соседние
 * `dist-*.test.ts`. */

const DIST = resolve(fileURLToPath(new URL('../../dist/', import.meta.url)));
const DIST_INDEX = resolve(fileURLToPath(new URL('../../dist/index.html', import.meta.url)));
const FACTORY_CORE_FILE = resolve(
  fileURLToPath(new URL('../components/FactoryCore.astro', import.meta.url)),
);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** Срез сбалансированного по вложенности `<div ...> … </div>` начиная с
 *  первого вхождения `openMarker` (например `<div class="factory-plate"`).
 *  Считает открывающие/закрывающие теги `div`, не полагаясь на то, что
 *  внутри нет вложенных `<div>` — а они есть (`.fp-frame`, `.fp-legs`). */
function sliceBalancedDiv(html: string, openMarker: string): { start: number; end: number; text: string } {
  const start = html.indexOf(openMarker);
  expect(start, `не найден маркер «${openMarker}» в dist/index.html`).toBeGreaterThan(-1);

  const tagStart = html.indexOf('>', start);
  expect(tagStart, `не найден конец открывающего тега для «${openMarker}»`).toBeGreaterThan(-1);

  const tagRe = /<div\b|<\/div>/g;
  tagRe.lastIndex = tagStart + 1;
  let depth = 1;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = tagRe.exec(html))) {
    depth += m[0].startsWith('</div') ? -1 : 1;
    if (depth === 0) {
      const end = m.index + m[0].length;
      return { start, end, text: html.slice(start, end) };
    }
  }
  throw new Error(`«${openMarker}» не сбалансирован по <div>/</div> в dist/index.html`);
}

describe('dist/ — плита фабрики (вариант владельца А «Плита»)', () => {
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

  const plate = sliceBalancedDiv(html, '<div class="factory-plate"');
  // Раздел 6 брифа: границы блока тизера целиком — заголовок, абзац, плита,
  // ссылка. Запрещённые формулировки (критерий 7) ищутся здесь, а не по всей
  // странице: слова могли бы легально встретиться где-то ещё на сайте.
  const teaser = sliceBalancedDiv(html, '<div class="teaser"');

  // Критерий 5.1 (файла компонента прежней схемы не существует).
  it('components/FactoryCore.astro не существует', () => {
    expect(existsSync(FACTORY_CORE_FILE)).toBe(false);
  });

  // Критерий 2: разметка блока похудела — с 15 090 байт у прежней схемы до
  // не более 3 000 у плиты.
  it('разметка `.factory-plate` — не больше 3 000 байт (замер до правки: 15 090)', () => {
    const bytes = Buffer.byteLength(plate.text, 'utf8');
    // eslint-disable-next-line no-console
    console.log(`.factory-plate: ${bytes} байт (было 15 090 у .factory-core)`);
    expect(bytes).toBeLessThanOrEqual(3000);
  });

  // Критерий 3: рисунок и все подписи присутствуют без выполнения JS.
  it('все четыре label, все четыре own и четыре строки «N тем» — в разметке дословно', () => {
    for (const t of FACTORY) {
      expect(plate.text, t.label).toContain(t.label);
      expect(plate.text, t.own).toContain(t.own);
      expect(plate.text, `${t.themes} ${FACTORY_CAPTIONS.themes}`)
        .toContain(`${t.themes} ${FACTORY_CAPTIONS.themes}`);
    }
  });

  it('все шесть строк FACTORY_FRAME — в разметке дословно', () => {
    for (const part of FACTORY_FRAME) {
      expect(plate.text, part).toContain(part);
    }
  });

  it('обе подписи FACTORY_CAPTIONS (own, frame) — в разметке дословно', () => {
    expect(plate.text).toContain(FACTORY_CAPTIONS.own);
    expect(plate.text).toContain(FACTORY_CAPTIONS.frame);
  });

  // Критерий 4: ни одной строки и ни одного числа не вписаны в разметку
  // руками — количество <li> совпадает со счётом данных. Astro вставляет
  // `data-astro-cid-…` внутрь открывающего тега, поэтому сравнение идёт по
  // префиксу, не по тегу целиком с `>`.
  it('<li class="fp-type"> ровно FACTORY.length, ячеек каркаса ровно FACTORY_FRAME.length', () => {
    const typeCount = countOccurrences(plate.text, '<li class="fp-type"');
    const totalLi = countOccurrences(plate.text, '<li');
    expect(typeCount).toBe(FACTORY.length);
    expect(totalLi - typeCount).toBe(FACTORY_FRAME.length);
  });

  // Критерий 5: ничего от прежней (SVG-тиковой) схемы не осталось.
  it('от прежней схемы (тики, гребёнки, легенда, клеймо) в dist/ не осталось', () => {
    for (const gone of ['core-svg', 'data-filled', 'ТЕМ ·', 'ДЕМО', 'BOT_FACTORY', 'Закрашенный тик']) {
      expect(html, gone).not.toContain(gone);
    }
  });

  // Критерий 6: терминов инженерного словаря в блоке тизера нет. Скоуп —
  // блок тизера, а не весь `dist/index.html`: слово «Docker» законно стоит
  // в стеке кейса «Заявка-Хаб» (`data/cases.ts`) — другой блок, другой
  // контекст, и правило про термины писалось про читателя ИМЕННО этого
  // блока (страх «получится дорого/непонятно»), а не про весь сайт.
  it('терминов RBAC/CI/миграций/JWT/Alembic/Docker/outbox в блоке тизера нет', () => {
    for (const term of ['RBAC', ' CI ', 'миграц', 'JWT', 'Alembic', 'Docker', 'outbox']) {
      expect(teaser.text, term).not.toContain(term);
    }
  });

  // Критерий 7: запрещённые формулировки — в границах блока тизера.
  it('запрещённые формулировки («единое ядро», «один движок», «ядро», «клиент»…) отсутствуют в блоке тизера', () => {
    const forbidden = [
      'единое ядро',
      'одна кодовая база',
      'один движок',
      'пет-проект',
      'клиент',
      'заказчик',
    ];
    for (const phrase of forbidden) {
      expect(teaser.text, phrase).not.toContain(phrase);
    }
    // «Ядро» отдельным словом — граница слова, чтобы не поймать случайное
    // совпадение внутри другого слова (в этом блоке такого нет, но проверка
    // должна ловить именно слово, а не подстроку).
    expect(/\bядр[а-яё]*\b/i.test(teaser.text), 'слово «ядро» встречается в блоке тизера').toBe(false);
  });

  // Критерий 15: цвет — `--accent` ровно один раз в стилях блока, лайм не
  // встречается нигде в dist/.
  it('лайм #C8FF45 не встречается нигде в dist/index.html', () => {
    expect(html.toUpperCase()).not.toContain('#C8FF45');
  });

  it('в собранном CSS `--accent` внутри правил `.fp-*`/`.factory-plate` встречается ровно один раз', () => {
    const cssFiles = walk(join(DIST, '_astro')).filter((f) => f.endsWith('.css'));
    let occurrences = 0;
    // Разбор по правилам (селектор { тело }), а не окно фиксированной длины:
    // окно ловило соседние несвязанные правила бандла (уже случилось —
    // 4000-символьное окно от `.fp-frame` захватило `--accent` печати и
    // ссылки, живущих в том же файле). Здесь берём ТОЛЬКО тело правил, чей
    // селектор содержит `.fp-` или `.factory-plate`.
    for (const file of cssFiles) {
      const css = readFileSync(file, 'utf8');
      for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selector = m[1];
        const body = m[2];
        if (!/\.fp-|\.factory-plate/.test(selector)) continue;
        occurrences += countOccurrences(body, 'var(--accent)');
      }
    }
    expect(occurrences, 'ожидался ровно один var(--accent) в правилах .fp-*/.factory-plate').toBe(1);
  });

  // Критерий 17: блок встречается на главной ровно один раз и не появляется
  // ни на одной другой странице сборки.
  it('плита — ровно один раз на главной, и нигде больше на сайте', () => {
    expect(countOccurrences(html, 'class="factory-plate"')).toBe(1);

    const otherPages = walk(DIST).filter((f) => f.endsWith('.html') && f !== DIST_INDEX);
    for (const file of otherPages) {
      const otherHtml = readFileSync(file, 'utf8');
      expect(otherHtml, file).not.toContain('factory-plate');
    }
  });
});

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extname, join } from 'node:path';

/* Сторож шкалы кеглей ([[02-redesign-options]], «Принято владельцем», пункт
 * 8 — предусловие: сначала свести самовольные кегли к семи объявленным, и
 * только потом их можно укрупнять). Проверяет СОБРАННЫЙ CSS, а не исходники:
 * до правки 2026-08-13 `Prose.astro` и `Metric.astro` несли кегли вне шкалы
 * (24…32 плавающий и 22 px) в исходном коде, но ни один не попадал в сборку —
 * `Prose` целиком выпадает из бандла (в него сегодня не приходит ни одного
 * <h2>/<h3>/<code>), а `Metric` живёт только на служебной витрине `/dev/ui`,
 * которая в обычную сборку не попадает вовсе (`lib/dev-pages.ts`,
 * `devPagesEnabled`). Проверка по исходникам их бы ложно провалила; проверка
 * по `dist` видит ровно то, что получит браузер.
 *
 * Тот же паттерн `existsSync`-гейта, что в `lib/sections.test.ts` и
 * `tests/dist-home-sections.test.ts`: без сборки тест падает с понятной
 * причиной, а не тихо пропускается. */
const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));
const ASSETS_DIR = join(DIST, '_astro');

/** Объявленная шкала (`styles/base.css`, классы `.t-*`) — восемь ролей,
 *  границы плавающих (`clamp`) и точные значения фиксированных. Семь из них
 *  живут на главной (замер [[02-redesign-options]], раздел 0); `h1` (28/48)
 *  используется только на посадочных страницах (`/contact`, `/404`,
 *  `/thanks`, …) и обязан остаться легальным для них. */
const SCALE_PX = new Set([
  11, // label
  14, // small
  16, // body
  18, // body-lg
  20, // h3
  22, 32, // h2 (границы clamp)
  28, 48, // h1 (границы clamp)
  34, 64, // display (границы clamp)
]);

/** Относительные значения, которые встречаются в собранном CSS не из нашей
 *  типографики, а из сброса Tailwind Preflight (`sub`/`sup`/`small`/`code` и
 *  т.п. — относительно родителя, поэтому у них нет собственного px). Список
 *  закрытый: новое значение обязано либо попасть сюда с объяснением, либо
 *  быть найдено и переведено в шкалу. */
const KNOWN_RELATIVE = new Set(['1em', '75%', '80%', 'inherit']);

function walk(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Одно найденное объявление размера — значение как есть плюс место, где
 *  оно стоит, для читаемого сообщения об ошибке. */
interface Found { raw: string; file: string; }

/** Достаёт значение размера из `font-size: …` и из размерного места
 *  шорткода `font: ВЕС РАЗМЕР/ВЫСОТА-СТРОКИ ШРИФТ` — в этой кодовой базе оба
 *  написания используются вперемешку (см. `base.css` против компонентов). */
function extractSizes(css: string, file: string): Found[] {
  const found: Found[] = [];
  const RE =
    /font-size:\s*([^;}]+)[;}]|font:\s*(?:[\d.]+\s+)?(clamp\([^)]*\)|[.\d]+(?:rem|px|em|%))\/[.\d]/g;
  for (const m of css.matchAll(RE)) {
    const raw = (m[1] ?? m[2] ?? '').trim();
    if (raw !== '') found.push({ raw, file });
  }
  return found;
}

/** Абсолютное значение (`rem`/`px`) → px. `rem` считается от корневых 16 px —
 *  `base.css` не переопределяет `font-size` у `html`, значит корень браузерный. */
function toPx(token: string): number | null {
  const rem = /^([.\d]+)rem$/.exec(token);
  if (rem) return parseFloat(rem[1]) * 16;
  const px = /^([.\d]+)px$/.exec(token);
  if (px) return parseFloat(px[1]);
  return null;
}

/** Плоский список px-значений из одного найденного `raw` — один элемент для
 *  простого значения, два (границы) для `clamp(мин, вязкое, макс)`. */
function resolvedPx(raw: string): number[] {
  if (raw.startsWith('clamp(')) {
    return [...raw.matchAll(/([.\d]+)(rem|px)/g)].map(
      (m) => toPx(`${m[1]}${m[2]}`)!,
    );
  }
  const px = toPx(raw);
  return px === null ? [] : [px];
}

describe('шкала кеглей в собранном CSS', () => {
  it('сборка существует (npm run build перед этим набором)', () => {
    if (!existsSync(ASSETS_DIR)) {
      throw new Error(
        `\n${ASSETS_DIR} не найден. Сначала выполни \`npm run build\` в web/, ` +
        'затем повтори `npm run test:unit`.',
      );
    }
    expect(true).toBe(true);
  });

  if (!existsSync(ASSETS_DIR)) return;

  const cssFiles = walk(ASSETS_DIR).filter((f) => extname(f) === '.css');

  it('нашлись CSS-файлы сборки', () => {
    expect(cssFiles.length).toBeGreaterThan(0);
  });

  const allFound: Found[] = cssFiles.flatMap((file) =>
    extractSizes(readFileSync(file, 'utf8'), file),
  );

  it('найдены хоть какие-то объявления размера шрифта (иначе сломан разбор)', () => {
    expect(allFound.length).toBeGreaterThan(0);
  });

  it('каждое относительное значение — из закрытого списка сбросов Preflight', () => {
    const bad = allFound.filter((f) => {
      if (f.raw.startsWith('clamp(')) return false;
      if (toPx(f.raw) !== null) return false; // абсолютное — проверяется отдельным тестом
      return !KNOWN_RELATIVE.has(f.raw);
    });
    expect(
      bad,
      bad
        .map((f) => `${f.raw} — ${f.file.replace(DIST, '')}`)
        .join('\n'),
    ).toEqual([]);
  });

  it('ни один px-размер (плоский или граница clamp) не лежит вне объявленной шкалы', () => {
    const offenders: string[] = [];
    for (const { raw, file } of allFound) {
      if (!raw.startsWith('clamp(') && toPx(raw) === null) continue; // относительное — уже проверено выше
      for (const px of resolvedPx(raw)) {
        if (!SCALE_PX.has(px)) {
          offenders.push(`${px}px (из «${raw}») — ${file.replace(DIST, '')}`);
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});

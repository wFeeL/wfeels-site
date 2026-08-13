import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extname, join, relative } from 'node:path';

/* Сторож против шорткода `animation:` в блоке, который уже несёт
 * `animation-timeline` — этот баг ловили в базе прозой дважды и он всё
 * равно дожил до третьего раза (`CaseFlowIllustration.astro`, задача 1
 * этого захода): сборщик Astro сворачивает `animation-timeline` вместе с
 * шорткодом `animation:` в один CSS-шорткод, а собранный Chromium такую
 * форму не разбирает и молча роняет `animationName` в `none` — рисунок
 * остаётся на нулевом кадре (`stroke-dashoffset: 1`, `opacity: 0`)
 * НАВСЕГДА, потому что документный fallback-таймлайн у сокращения тоже
 * пропадает. Проза не удержала правило — держит тест.
 *
 * Тот же приём для починки уже задокументирован комментарием
 * `BackgroundLine.astro:124-129` и применён в `FactoryCore.astro`,
 * `FactoryStamp.astro`, `Pricing.astro`, `CaseDialogueIllustration.astro`:
 * писать раздельными свойствами (`animation-name`, `animation-duration`,
 * `animation-timing-function`, `animation-fill-mode`, `animation-timeline`,
 * `animation-range`), никогда не собирать их в один `animation: …`.
 *
 * Тест читает ИСХОДНИКИ (`web/src/**`), а не `dist` — ловит ошибку до
 * сборки, а не после нехватки анимации на глаз. Сканирует все `*.astro` и
 * `*.css`, вычленяет из каждого <style> (или файла .css целиком) ЛИСТОВЫЕ
 * блоки деклараций — тела обычных правил без вложенных `{` внутри,
 * то есть не обёртки `@media`/`@supports` — и для каждого такого блока: если
 * в нём есть `animation-timeline`, шорткод `animation:` в этом же блоке
 * запрещён. */

const SRC_DIR = fileURLToPath(new URL('../', import.meta.url));

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'tests') continue; // тесты сами не проверяются — это не UI-код
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (extname(entry) === '.astro' || extname(entry) === '.css') {
      out.push(full);
    }
  }
  return out;
}

function extractStyleBlocks(source: string, isAstro: boolean): string[] {
  if (!isAstro) return [source];
  const blocks: string[] = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) blocks.push(m[1]);
  return blocks;
}

/** Комментарии `/* … *\/` вычищаются ДО брейс-матчинга и ДО проверки на
 *  шорткод: и этот же файл, и `BackgroundLine.astro` объясняют приём прозой
 *  прямо в CSS-комментарии («не сокращение `animation:` — …»), а такая
 *  проза сама содержит подстроку `animation:` — без вычистки сторож ловил
 *  бы собственное объяснение правила как нарушение. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Возвращает тела ЛИСТОВЫХ блоков — правил без вложенных `{` внутри (то
 *  есть обычных селекторов с декларациями, а не обёрток `@media`/`@supports`,
 *  которые сами содержат вложенные блоки). Простой брейс-матчинг через
 *  стек — в этом кодбейсе нет CSS-вложенности (`&`), так что декларации
 *  никогда сами не несут `{`. */
function leafDeclarationBlocks(rawCss: string): string[] {
  const css = stripComments(rawCss);
  const leaves: string[] = [];
  const stack: number[] = [];
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      stack.push(i);
    } else if (ch === '}') {
      const start = stack.pop();
      if (start === undefined) continue;
      const body = css.slice(start + 1, i);
      if (!body.includes('{')) leaves.push(body);
    }
  }
  return leaves;
}

const ANIMATION_TIMELINE_RE = /\banimation-timeline\s*:/;
// Требует двоеточие (с необязательными пробелами) сразу после `animation` —
// не совпадает с `animation-name:`, `animation-duration:` и т.д., у которых
// после `animation` идёт `-`, а не пробел/двоеточие.
const ANIMATION_SHORTHAND_RE = /\banimation\s*:/;

const files = walk(SRC_DIR);

describe('CSS-сторож: `animation:` (шорткод) запрещён в блоке с `animation-timeline`', () => {
  it('нашлись файлы для проверки (сторож не молчит вхолостую)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const isAstro = file.endsWith('.astro');
    const styleBlocks = extractStyleBlocks(source, isAstro);
    if (styleBlocks.length === 0) continue;

    for (const style of styleBlocks) {
      const leaves = leafDeclarationBlocks(style);
      for (const leaf of leaves) {
        if (!ANIMATION_TIMELINE_RE.test(leaf)) continue;

        it(`${relative(SRC_DIR, file)}: блок с animation-timeline не собран в шорткод animation:`, () => {
          expect(
            leaf,
            `Найден шорткод \`animation:\` в блоке, который уже несёт ` +
              `\`animation-timeline\` (${relative(SRC_DIR, file)}). Сборка сворачивает их в ` +
              'один CSS-шорткод, который собранный Chromium не разбирает и молча роняет ' +
              'анимацию целиком. Замени шорткод раздельными свойствами: animation-name, ' +
              'animation-duration, animation-timing-function, animation-fill-mode ' +
              '(animation-timeline и animation-range уже раздельные). Блок:\n' +
              leaf,
          ).not.toMatch(ANIMATION_SHORTHAND_RE);
        });
      }
    }
  }
});

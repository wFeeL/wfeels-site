import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Сторож финала страницы — **переписан целиком** `2026-08-27`
 *  (`70-workshop/specs/site-v3/15-line-through-scale-brief.md`, раздел 2.5,
 *  приёмка П-Ф1/П-Ф3). Прежняя версия (до правки) мерила `scaleY` шторки
 *  `[data-line-last] .line-curtain` — механика посекционных окон, снятая
 *  этим брифом. Предмет проверки («линия дорисована до низа документа, без
 *  видимого разрыва») не изменился — изменился только способ измерения.
 *
 *  НОВЫЙ МЕТОД (раздел 2.5 брифа): единственная сквозная шторка накрывает
 *  экран от `--line-head` до низа окна; после переезда `footer::before` на
 *  `z-index: -2` (выше шторки) финал страницы не требует анимации вовсе —
 *  условие полноты чисто геометрическое: `vh − footerH − 58 < --line-head`.
 *  Проверяется тремя независимыми числами: (1) формула выполняется, (2)
 *  последняя несущая линию секция дорисована до самого конца ПОЛНОСТЬЮ на
 *  максимальной прокрутке (тем же геометрическим методом, что и
 *  `background-line-ink-continuity.spec.ts`), (3) в подвале нет ни пикселя
 *  краски линии ни на одной из проверяемых высот (П-Ф3).
 *
 *  Список СТРАНИЦ — не вписан руками (ловушки 15/21/24, `50-code/
 *  CLAUDE.md`): выводится обходом `dist/**\/*.html` по наличию атрибута
 *  `data-line-last` — линия сегодня стоит только на `/` и `/en`. */

const DIST = fileURLToPath(new URL('../../../dist/', import.meta.url));
const LAST_MARKER = 'data-line-last';

/** Три высоты окна, названные разделом 2.5 брифа («проверено живьём на
 *  1440×900, 1440×1200, 1440×1500: во всех трёх скрыто головой 0 px») —
 *  не подобраны здесь. */
const HEIGHTS = [900, 1200, 1500] as const;
const WIDTH = 1440;

function htmlFiles(dir: string, base = dir): string[] {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    if (entry.name === '_astro') return [];
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full, base);
    return entry.name.endsWith('.html') ? [relative(base, full)] : [];
  });
}

function urlFromHtmlFile(relPath: string): string {
  const posix = relPath.split(sep).join('/');
  if (posix === 'index.html') return '/';
  if (posix.endsWith('/index.html')) return `/${posix.slice(0, -'/index.html'.length)}`;
  return `/${posix.replace(/\.html$/, '')}`;
}

if (!existsSync(DIST)) {
  throw new Error(
    'background-line-footer-reach.spec.ts: сборка не найдена ' +
    `(${DIST}). Список страниц выводится из dist/ (ловушка 15, ` +
    '`50-code/CLAUDE.md`) — сначала `npm run build` в web/.',
  );
}

const PAGES = htmlFiles(DIST)
  .filter((file) => readFileSync(join(DIST, file), 'utf8').includes(LAST_MARKER))
  .map(urlFromHtmlFile)
  .sort();

test.describe('линия на фоне — финал страницы дорисован без анимации (П-Ф1)', () => {
  test('на dist/ найдена хотя бы одна страница с [data-line-last]', () => {
    expect(PAGES.length, 'PAGES пуст — либо линию сняли отовсюду, либо маркер переименовали').toBeGreaterThan(0);
  });

  for (const path of PAGES) {
    for (const height of HEIGHTS) {
      test(`${path} @ ${WIDTH}×${height}: формула полноты выполняется и краска дорисована до конца`, async ({ browser }) => {
        const ctx = await browser.newContext({
          reducedMotion: 'no-preference',
          viewport: { width: WIDTH, height },
        });
        const page = await ctx.newPage();
        await page.goto(path);
        await page.waitForTimeout(1600); // line-load героя, 1400ms + запас

        const geometry = await page.evaluate(() => {
          const footer = document.querySelector('footer');
          const probe = document.createElement('div');
          probe.style.position = 'fixed';
          probe.style.visibility = 'hidden';
          probe.style.top = 'var(--line-head)';
          document.body.appendChild(probe);
          const lineHead = probe.getBoundingClientRect().top;
          probe.remove();
          return {
            vh: window.innerHeight,
            footerH: footer ? footer.getBoundingClientRect().height : 0,
            lineHead,
          };
        });

        // Условие раздела 2.5 брифа: vh − footerH − 58 < --line-head.
        const completeness = geometry.vh - geometry.footerH - 58;
        expect(
          completeness,
          `формула полноты не выполняется: vh(${geometry.vh}) - footerH(${geometry.footerH}) - 58 ` +
            `= ${completeness} обязано быть < --line-head (${geometry.lineHead})`,
        ).toBeLessThan(geometry.lineHead);

        const maxScroll = await page.evaluate(
          () => document.documentElement.scrollHeight - window.innerHeight,
        );
        expect(maxScroll, 'страница не прокручивается — тест бессмыслен').toBeGreaterThan(100);

        await page.evaluate((y) => window.scrollTo(0, y), maxScroll);
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );

        // Последняя несущая линию секция ([data-line-last]) обязана быть
        // дорисована ПОЛНОСТЬЮ: ВИДИМАЯ часть её пути обязана стоять целиком
        // выше головы на максимальной прокрутке.
        //
        // ПРАВКА (найдено этим прогоном): первая редакция брала
        // `path.getBoundingClientRect().bottom` — необрезанный геометрический
        // бокс ВСЕГО пути. У `contact` (`OVERHANG`, раздел 2.3 брифа) торец
        // кривой лежит на `vbY 878`, за пределами `viewBox` (818), и уходит
        // ЗА ЛЕВУЮ кромку окна (`vbX -200`) — на экране это `x ≈ -246px` при
        // `1440×1200`, доказано отдельным замером. `getBoundingClientRect()`
        // считает эту точку как «нижнюю кромку пути», хотя физически она
        // НЕВИДИМА (левее `x=0`, дальше страница не рисует ничего — то же
        // `overflow-x` держит «линия на фоне — не создаёт горизонтальной
        // прокрутки» выше по файлу `background-line.spec.ts`). Наивный замер
        // давал ложное красное на `1440×1200` (нижняя кромка 981,6 при
        // голове 960,0) и `1440×1500` (1281,6 при 1200,0) — снимок той же
        // точки прокрутки показал в этой полосе только текст подвала, ни
        // одного пикселя краски. Это тот же род ошибки, что ловушка 26
        // (`50-code/CLAUDE.md`): мерился геометрический артефакт, которого
        // страница не показывает.
        //
        // Починка — сэмплировать путь `getPointAtLength()` (та же техника,
        // что `background-line-narrator.spec.ts`, `toPagePoint`) и брать
        // максимум Y только по точкам, чей экранный X лежит В ПРЕДЕЛАХ
        // видимой ширины окна `[0, innerWidth]`. Общий метод, не завязанный
        // на форму конкретно `contact` — переживёт правку геометрии путей.
        const result = await page.evaluate(() => {
          const last = document.querySelector('[data-line-last]');
          if (!last) return null;
          const path = last.querySelector('svg.line > path:not(.line-branch):not(.line-head)') as SVGPathElement | null;
          if (!path) return null;
          const svg = path.closest('svg') as SVGSVGElement;
          const svgRect = svg.getBoundingClientRect();
          const vb = svg.viewBox.baseVal;
          const scaleX = vb.width > 0 ? svgRect.width / vb.width : 1;
          const scaleY = vb.height > 0 ? svgRect.height / vb.height : 1;
          const curtain = document.querySelector('.line-curtain') as HTMLElement;
          const curtainTop = curtain.getBoundingClientRect().top;
          const vw = window.innerWidth;

          const len = path.getTotalLength();
          const SAMPLES = 400;
          let visibleBottom = -Infinity;
          for (let i = 0; i <= SAMPLES; i += 1) {
            const pt = path.getPointAtLength((i / SAMPLES) * len);
            const screenX = svgRect.left + (pt.x - vb.x) * scaleX;
            const screenY = svgRect.top + (pt.y - vb.y) * scaleY;
            if (screenX >= 0 && screenX <= vw && screenY > visibleBottom) visibleBottom = screenY;
          }
          return { visibleBottom, curtainTop };
        });
        expect(result, '[data-line-last] или её путь не найдены на странице').not.toBeNull();
        if (result) {
          expect(
            result.visibleBottom,
            `видимая часть пути последней секции не дорисована на максимальной прокрутке: ` +
              `нижняя кромка ${result.visibleBottom.toFixed(1)}, голова стоит на ${result.curtainTop.toFixed(1)} — ` +
              'видимая (x в пределах окна) часть пути обязана кончаться ВЫШЕ головы (уже раскрыт) на дне документа',
          ).toBeLessThanOrEqual(result.curtainTop + 1);
        }

        await ctx.close();
      });
    }
  }
});

/** ПЕРЕПИСАН ЦЕЛИКОМ `2026-08-27` (`70-workshop/specs/site-v3/
 *  16-line-digits-and-finale-brief.md`, раздел 3.3, вариант Б «Разгон»,
 *  выбран владельцем). Предмет этого блока «в подвале нет краски линии»
 *  (`П-Ф3` брифа `15-…») отменяется вариантом Б дословно (раздел 3.3, п. 5
 *  списка «чем жертвует») и заменяется ПРОТИВОПОЛОЖНЫМ по смыслу пунктом:
 *  подвал ОБЯЗАН нести `.line` (уход переехал сюда с `contact`), но не
 *  обязан и не должен нести ни одного акцентного пикселя (`П-Ф-Б6`, `D-128`
 *  — «в подвале нуль акцента» держится нулём совпадений с вычисленным
 *  `--accent`, а не отсутствием линии как таковой: краска ствола лежит на
 *  плотности 13%/17%, той же, что несёт полотно на главной, и это не тот
 *  же цвет, что чистый `--accent`).
 *
 *  Порядок слоёв (`П-Ф-Б5`) не отменяется, а РАСШИРЯЕТСЯ: `footer::before`
 *  остаётся на `−2` (D-126, раздел 2.4 брифа `15-…», не тронуто), сама
 *  линия подвала и её местная шторка (`.line-curtain-local`) стоят на `−1`
 *  — выше фона подвала, ниже содержимого, `footer` собственного
 *  `z-index` по-прежнему не заводит. */
test.describe('линия на фоне — подвал несёт линию без акцента (П-Ф-Б5/П-Ф-Б6, вариант Б брифа `16-…`)', () => {
  for (const path of PAGES) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${path}, тема ${colorScheme}: порядок слоёв верен, линия в подвале есть, акцента в подвале нет`, async ({ browser }) => {
        const ctx = await browser.newContext({ reducedMotion: 'no-preference', colorScheme, viewport: { width: WIDTH, height: 900 } });
        const page = await ctx.newPage();
        await page.goto(path);
        await page.waitForTimeout(1600);
        const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
        await page.evaluate((y) => window.scrollTo(0, y), maxScroll);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

        // П-Ф-Б5 — порядок слоёв: footer::before на -2 (не тронуто), footer
        // своего z-index не завёл, .line/.line-curtain-local подвала — на -1.
        const layers = await page.evaluate(() => {
          const footer = document.querySelector('footer');
          if (!footer) return null;
          const before = getComputedStyle(footer, '::before');
          const line = footer.querySelector(':scope > svg.line') as HTMLElement | null;
          const curtainLocal = footer.querySelector(':scope > .line-curtain-local') as HTMLElement | null;
          return {
            ownZIndex: getComputedStyle(footer).zIndex,
            beforeZIndex: before.zIndex,
            lineZIndex: line ? getComputedStyle(line).zIndex : null,
            curtainLocalZIndex: curtainLocal ? getComputedStyle(curtainLocal).zIndex : null,
            hasLine: Boolean(line),
          };
        });
        expect(layers, 'в подвале нет <footer> вовсе').not.toBeNull();
        if (!layers) return;
        expect(layers.ownZIndex, 'footer завёл собственный z-index — уронил бы -2 в чужой локальный стек').toBe('auto');
        expect(layers.beforeZIndex, 'footer::before обязан стоять на z-index:-2 (раздел 2.4 брифа 15-…)').toBe('-2');
        expect(layers.hasLine, 'у подвала нет .line — вариант Б ожидает уход, переехавший с contact (раздел 3.3 брифа 16-…)').toBe(true);
        expect(layers.lineZIndex, 'линия подвала обязана стоять на z-index:-1, выше footer::before').toBe('-1');
        if (layers.curtainLocalZIndex !== null) {
          expect(layers.curtainLocalZIndex, 'местная шторка подвала обязана стоять на z-index:-1').toBe('-1');
        }

        // П-Ф-Б6 — D-128, нуль акцента в подвале: вычисленный --accent не
        // совпадает НИ С ОДНИМ цветовым свойством ни одного узла <footer>.
        // Приём тот же, что уже держит D-128 на остальной странице —
        // сопоставление вычисленного значения, а не визуальная оценка.
        const accentMatches = await page.evaluate(() => {
          const footer = document.querySelector('footer');
          if (!footer) return [];
          const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
          const probe = document.createElement('div');
          probe.style.color = accent;
          document.body.appendChild(probe);
          const accentRgb = getComputedStyle(probe).color;
          probe.remove();

          const PROPS = [
            'color',
            'backgroundColor',
            'borderTopColor',
            'borderRightColor',
            'borderBottomColor',
            'borderLeftColor',
            'outlineColor',
            'textDecorationColor',
            'fill',
            'stroke',
          ] as const;
          const matches: string[] = [];
          const nodes = [footer, ...Array.from(footer.querySelectorAll('*'))];
          for (const node of nodes) {
            const cs = getComputedStyle(node as Element);
            for (const prop of PROPS) {
              const value = cs[prop as keyof CSSStyleDeclaration] as unknown as string;
              if (value && value === accentRgb) {
                const el = node as Element;
                matches.push(`${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).replace(/\s+/g, '.') : ''}: ${prop}`);
              }
            }
          }
          return matches;
        });
        expect(accentMatches, `D-128 нарушен: акцентный цвет найден в подвале на: ${accentMatches.join(', ')}`).toEqual([]);

        await ctx.close();
      });
    }
  }
});

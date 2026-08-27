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

test.describe('линия на фоне — краски в подвале нет (П-Ф3, D-126 правка раздела 2.4 брифа)', () => {
  for (const path of PAGES) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${path}, тема ${colorScheme}: footer::before на z-index:-2, свой z-index не заведён, краски линии в подвале нет`, async ({ browser }) => {
        const ctx = await browser.newContext({ reducedMotion: 'no-preference', colorScheme, viewport: { width: WIDTH, height: 900 } });
        const page = await ctx.newPage();
        await page.goto(path);
        await page.waitForTimeout(1600);
        const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
        await page.evaluate((y) => window.scrollTo(0, y), maxScroll);
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

        const footerStyle = await page.locator('footer').evaluate((el) => {
          const before = getComputedStyle(el, '::before');
          return { ownZIndex: getComputedStyle(el).zIndex, beforeZIndex: before.zIndex };
        });
        expect(footerStyle.ownZIndex, 'footer завёл собственный z-index — уронил бы -2 в чужой локальный стек').toBe('auto');
        expect(footerStyle.beforeZIndex, 'footer::before обязан стоять на z-index:-2 (раздел 2.4 брифа 15-…)').toBe('-2');

        const noLineInFooter = await page.evaluate(
          () => document.querySelector('footer')?.querySelector('.line, .line-curtain') === null,
        );
        expect(noLineInFooter, 'в подвале остался .line/.line-curtain').toBe(true);

        await ctx.close();
      });
    }
  }
});

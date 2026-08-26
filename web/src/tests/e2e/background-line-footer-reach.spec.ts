import { test, expect } from '@playwright/test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Сторож «линия не доходит до подвала» (блокер 2026-08-26, владелец
 *  дословно: «линия должна быть едина на всей странице… без зазоров»).
 *
 *  Сторож непрерывности `background-line-ink-continuity.spec.ts` этот
 *  дефект НЕ ловил: он проверяет отсутствие ДВУХ кусков чернил в одном
 *  кадре, а дефект был не «два куска», а «один кусок, который на самом
 *  дне документа не дорисован вовсе» — сканирование там не доходит до
 *  сравнения с фактическим низом документа, только до отсутствия разрывов
 *  внутри уже нарисованного.
 *
 *  Причина дефекта была геометрической, не пиксельной, поэтому и проверка
 *  здесь геометрическая, тем же приёмом, что уже несёт
 *  `background-line.spec.ts` (`transform: scaleY(...)` шторки последней
 *  секции читается напрямую из вычисленного `matrix(...)`, без деления на
 *  высоту бокса — раздел «ПРАВКА 2026-08-21» в том файле): на максимальной
 *  прокрутке страницы шторка хвоста подвала (`[data-line-last]
 *  .line-curtain`) обязана стоять на `scaleY(0)` — полностью убрана,
 *  краска дорисована до низа документа. `scaleY` держится не строго на
 *  нуле из-за суб-пиксельного округления `getBoundingClientRect`/раскладки
 *  шрифтов между прогонами — допуск `MAX_SCALE_Y = 0.01` (1% высоты
 *  бокса шторки, не путать с порогом «в процессе» 0,02 у соседнего
 *  сторожа: там измеряется, ДВИЖЕТСЯ ли элемент, здесь — дорисован ли он
 *  ДО КОНЦА, порог обязан быть теснее).
 *
 *  Высоты вьюпорта — все пять, которыми задача измерила дефект и его
 *  починку (700/844/900/1080/1400, отчёт задачи): 700 и 844 были почти
 *  готовы (0,876 и 0,981 — недорисованы, но хоть двигались), 900/1080/1400
 *  стояли на 1,000 (шторка ни на пиксель не открывалась) — разный
 *  механизм неисправности («старт диапазона недостижим» против «весь
 *  диапазон физически лежит за концом документа», разбор — сам блокер и
 *  комментарий у правила в `BackgroundLine.astro`), поэтому обе группы
 *  остаются в списке проверки, а не только одна репрезентативная высота.
 *
 *  Список СТРАНИЦ — не вписан руками (ловушки 15/21/24, `50-code/
 *  CLAUDE.md`): выводится обходом `dist/**\/*.html` по наличию атрибута
 *  `data-line-last` — линия сегодня стоит только на `/` и `/en`, но список
 *  не протухнет молча, если её подключат ещё где-то. */

const DIST = fileURLToPath(new URL('../../../dist/', import.meta.url));
const LAST_MARKER = 'data-line-last';

/** Пять высот, которыми задача измерила дефект и его починку (отчёт
 *  задачи, раздел «Диагноз») — не подобраны здесь, а перенесены из условия
 *  приёмки блокера. Ширина вьюпорта (1440) — та же, на которой снята
 *  таблица замера в брифе задачи, линия видима с 480px, 1440 — обычный
 *  десктоп, не край диапазона. */
const HEIGHTS = [700, 844, 900, 1080, 1400] as const;
const WIDTH = 1440;

/** Допуск полноты раскрытия — доля высоты бокса шторки, не пикселей: та же
 *  безразмерная величина, что несёт `scaleY` сам по себе (раздел 7.1 брифа
 *  `05-line.md`). 1% — на порядок теснее порога «в процессе» (2%) у
 *  соседнего сторожа непрерывности, потому что здесь проверяется не факт
 *  движения, а факт ЗАВЕРШЕНИЯ. */
const MAX_SCALE_Y = 0.01;

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

test.describe('линия на фоне — хвост подвала дорисован на максимальной прокрутке', () => {
  test('на dist/ найдена хотя бы одна страница с [data-line-last]', () => {
    expect(PAGES.length, 'PAGES пуст — либо линию сняли отовсюду, либо маркер переименовали').toBeGreaterThan(0);
  });

  for (const path of PAGES) {
    for (const height of HEIGHTS) {
      test(`${path} @ ${WIDTH}×${height}: краска доходит до низа документа`, async ({ browser }) => {
        const ctx = await browser.newContext({
          reducedMotion: 'no-preference',
          viewport: { width: WIDTH, height },
        });
        const page = await ctx.newPage();
        await page.goto(path);
        await page.waitForTimeout(1600); // line-load героя (раздел 7.4 брифа), 1400ms + запас

        const maxScroll = await page.evaluate(
          () => document.documentElement.scrollHeight - window.innerHeight,
        );
        expect(maxScroll, 'страница не прокручивается — тест бессмыслен').toBeGreaterThan(100);

        await page.evaluate((y) => window.scrollTo(0, y), maxScroll);
        // Скролл-таймлайн пересчитывается на кадре компоновки, не синхронно
        // со `scrollTo()` — тот же приём, что и у остальных сторожей линии.
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );

        const scaleY = await page.evaluate(() => {
          const curtain = document.querySelector('[data-line-last] .line-curtain');
          if (!curtain) return null;
          const t = getComputedStyle(curtain).transform;
          const m = t.match(/matrix\(([^)]+)\)/);
          return m ? parseFloat(m[1].split(',')[3]) : 1;
        });

        await ctx.close();

        expect(scaleY, '[data-line-last] .line-curtain не найден на странице').not.toBeNull();
        expect(
          scaleY as number,
          `шторка хвоста подвала не дорисована на дне документа: scaleY=${scaleY} ` +
            `(допуск ${MAX_SCALE_Y}) на ${path}, ${WIDTH}×${height}`,
        ).toBeLessThanOrEqual(MAX_SCALE_Y);
      });
    }
  }
});

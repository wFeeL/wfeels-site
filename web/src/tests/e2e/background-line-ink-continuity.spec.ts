import { test, expect } from '@playwright/test';

/** Сторож «оторванного куска линии» (дизайн-ревью 2026-08-21, задача
 *  «пролагивает при листании», D-080). Разбор дефекта — комментарий у
 *  `CAP_OVERHANG` в `lib/linePaths.ts` и правка `overhangPercent` там же.
 *
 *  Существующий `background-line.spec.ts` («ровно один элемент в
 *  промежуточном состоянии») меряет СОСТОЯНИЕ шторок (`scaleY` каждой
 *  `.line-curtain`) — он не видит эту разновидность дефекта, потому что обе
 *  соседние шторки, взятые ПО ОТДЕЛЬНОСТИ, были в корректном состоянии
 *  (`scaleY(1)`/`scaleY(0)`, что для теста «ровно один» — законные
 *  крайности, не «промежуточное»). Разрыв возникал не в состоянии шторки, а
 *  в ГЕОМЕТРИИ её бокса: бокс соседней (нижней) секции не доставал ровно на
 *  `stroke-width / 2` до закрашенного `round`-полукруга ЕЁ ЖЕ пути, и этот
 *  полукруг, будучи статично нарисованным (раздел 7.2 брифа `05-line`,
 *  D-080), красился поверх шторки СОСЕДНЕЙ (верхней) секции — обе шторки
 *  живут в одном стековом контексте на `z-index: -1` (раздел 6.1 брифа),
 *  красятся в порядке DOM, и та, что позже, кроет ту, что раньше.
 *
 *  Метод — ровно тот, каким дефект нашло ревью: пиксельный срез вертикальной
 *  колонки на доке линии, вокруг КАЖДОГО стыка секций, и поиск ВТОРОГО
 *  островка чернил после первого разрыва фоном (не состояние анимации —
 *  то, что фактически нарисовано). Проверяются все десять стыков главной
 *  плюс хвост подвала, три ширины (768/1440/1920 — 390 ниже порога 480 px,
 *  на котором линии нет вовсе, раздел 8 брифа `05-line`, B.11 бэклога) и обе
 *  темы. */

interface Rgb { r: number; g: number; b: number }

/** Цвет чернил — вычисленный `stroke` любого `.line path` (одинаков по всей
 *  странице, раздел 7.2 брифа `05-line`: один токен `--accent`/`--line-
 *  opacity` на весь сайт). Нужен ОТДЕЛЬНО от `bg`-эталона: классификация
 *  «не равно фону → чернила» ловит ЛЮБОЕ постороннее содержимое рядом с
 *  доком (например, текст ссылки подвала «Гарантии» — найдено при первом
 *  прогоне этого сторожа) как ложные чернила. Пиксель, не похожий НИ на
 *  фон, НИ на чернила, — не встающий в цепочку прогонов случай, реальный
 *  сторож смотрит только на то, что похоже на линию. */
async function inkReference(page: import('@playwright/test').Page): Promise<Rgb> {
  return page.evaluate(() => {
    const path = document.querySelector('.line path') as SVGPathElement;
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    const cctx = canvas.getContext('2d')!;
    cctx.fillStyle = getComputedStyle(path).stroke;
    cctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = cctx.getImageData(0, 0, 1, 1).data;
    return { r, g, b };
  });
}

/** Стыки — пары соседних боксов линии, док нижнего читается из первой точки
 *  `d` его пути (та же техника, что и `background-line-stitch-blend.spec.ts`
 *  `measureGeometry`), точка стыка — низ верхнего бокса. Фон-эталон читается
 *  С ТОГО ЖЕ элемента, что кроет стык фактически, — НИЖНЕЙ `.line-curtain`
 *  (та, что позже в DOM, красится поверх соседней, раздел 6.1 брифа): для
 *  подвала это `color-mix(--bg, --footer-bg-mix, black)` (`Footer.astro`),
 *  на пару оттенков темнее голого `--bg` — плоский `var(--bg)` как эталон
 *  давал бы ложный «островок» ровно на стыке `contact→footer`. */
async function stitches(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const boxes = Array.from(document.querySelectorAll('[data-line-side]')) as HTMLElement[];
    const out: { label: string; x: number; y: number; bg: Rgb }[] = [];
    for (let i = 1; i < boxes.length; i++) {
      const upper = boxes[i - 1];
      const lower = boxes[i];
      const path = lower.querySelector('.line path') as SVGPathElement | null;
      const svg = path?.closest('svg') as SVGSVGElement | null;
      const curtain = lower.querySelector('.line-curtain') as HTMLElement | null;
      if (!path || !svg || !curtain) continue;
      const rect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const scaleX = vb.width > 0 ? rect.width / vb.width : 1;
      const d = path.getAttribute('d') || '';
      const nums = (d.match(/-?\d+\.?\d*/g) || []).map(Number);
      const dockXvb = nums[0];
      const dockXpx = rect.left + dockXvb * scaleX;
      const stitchY = upper.getBoundingClientRect().bottom + window.scrollY;
      // `getComputedStyle` на `color-mix()` в Chromium сериализуется как
      // `color(srgb r g b)` (компоненты 0…1), НЕ `rgb(...)` — canvas
      // нормализует ЛЮБОЙ синтаксис CSS-цвета к rgb 0…255 через `fillStyle`,
      // не нужно парсить оба формата руками.
      const bgColor = getComputedStyle(curtain).backgroundColor;
      const canvas = document.createElement('canvas');
      canvas.width = 1; canvas.height = 1;
      const cctx = canvas.getContext('2d')!;
      cctx.fillStyle = bgColor;
      cctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = cctx.getImageData(0, 0, 1, 1).data;
      out.push({
        label: `${upper.id || upper.tagName.toLowerCase()}→${lower.id || lower.tagName.toLowerCase()}`,
        x: dockXpx,
        y: stitchY,
        bg: { r, g, b },
      });
    }
    return out;
  });
}

/** Классифицирует вертикальный срез в окне вокруг стыка при ОДНОЙ заданной
 *  прокрутке: `ink` — похож на вычисленный `stroke` линии, `bg` — похож на
 *  фон стыка (эталон стыка, `stitches()`), иначе `other` (постороннее
 *  содержимое рядом с доком — например, текст ссылки подвала) и в прогоны не
 *  идёт вовсе: сторож обязан видеть только линию, не всё, что не является
 *  фоном. Возвращает список раздельных прогонов `ink`/`bg` (минимум 3 px,
 *  чтобы не ловить сглаживание на кромке штриха).
 *
 *  Прокрутку задаёт ВЫЗЫВАЮЩИЙ (`scrollTarget`), не эта функция: дефект
 *  «оторванный кусок линии» — это состояние шторки НИЖНЕЙ секции ДО начала
 *  ЕЁ СОБСТВЕННОГО окна раскрытия (`scaleY(1)`, «в покое») при уже открытой
 *  ВЕРХНЕЙ — то есть широкий диапазон прокрутки, а не одна точная позиция.
 *  Первый прогон этого сторожа (замер 2026-08-21) центрировал стык в
 *  вьюпорте (`y − vh/2`) и НЕ поймал уже подтверждённый живым пиксельным
 *  срезом дефект на стыке `hero→pain`: при этой прокрутке `pain` уже
 *  ощутимо провернула СВОЁ окно (кончик у 67 % высоты вьюпорта, раздел 7.4
 *  брифа `05-line` — стык у центра вьюпорта соответствует прогрессу внутри
 *  окна, не состоянию покоя ДО него). Сторож ниже перебирает несколько
 *  прокруток на стык, а не гадает одну. */
async function scanStitch(
  page: import('@playwright/test').Page,
  x: number,
  y: number,
  bg: Rgb,
  ink: Rgb,
  scrollTarget: number,
): Promise<{ kind: 'ink' | 'bg'; len: number }[]> {
  const WINDOW = 350;
  const vh = page.viewportSize()!.height;
  await page.evaluate((sy) => window.scrollTo(0, sy), Math.max(0, scrollTarget));
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const scrollY = await page.evaluate(() => window.scrollY);
  const top = Math.max(0, y - WINDOW - scrollY);
  const bottom = Math.min(vh, y + WINDOW - scrollY);
  if (bottom - top < 10 || top >= bottom) return [];
  const buf = await page.screenshot({ clip: { x: x - 1, y: top, width: 2, height: bottom - top } });
  const rows: Rgb[] = await page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('decode')); img.src = `data:image/png;base64,${b64}`; });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const out: Rgb[] = [];
    for (let py = 0; py < canvas.height; py++) {
      const i = (py * canvas.width) * 4;
      out.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
    }
    return out;
  }, buf.toString('base64'));

  const DELTA = 8; // допуск сглаживания/подпикселя
  const close = (c: Rgb, ref: Rgb) =>
    Math.abs(c.r - ref.r) <= DELTA && Math.abs(c.g - ref.g) <= DELTA && Math.abs(c.b - ref.b) <= DELTA;
  const rawKinds: ('ink' | 'bg' | 'other')[] = rows.map((c) =>
    close(c, bg) ? 'bg' : close(c, ink) ? 'ink' : 'other',
  );

  /** Ловушка, найденная замером 768px/светлая тема: фотография в `about`
   *  местами (у самого нижнего края, где кадр гаснет в светлый тон) даёт
   *  ПЛАВНЫЙ градиент, случайно проходящий через `DELTA`-окрестность
   *  фонового цвета — не потому что это фон, а потому что цвет фотографии
   *  в этой точке ей случайно близок. Отличить одно от другого по
   *  ОДНОМУ пикселю нельзя (расстояние до `bg` у него и правда мало), но
   *  можно по ПЛОСКОСТИ: `.line`/`.line-curtain` красятся сплошной CSS-
   *  заливкой без сжатия — внутри своего пробега они бит-в-бит одинаковы на
   *  десятки-сотни пикселей подряд. Фотография — растровые данные, даже на
   *  почти однотонном участке две соседние строки СОВПАДАЮТ ЛИШЬ
   *  СЛУЧАЙНО и никогда надолго (в замеренном случае — не больше 3 строк
   *  подряд). Порог `MIN_FLAT_STREAK = 6` лежит между этим потолком (3) и
   *  минимальным реальным разрывом, который вообще способна дать геометрия
   *  (половина толщины штриха, раздел выше по задаче — 15…24 px даже на
   *  узкой ширине) — с запасом в обе стороны, не подогнан под точное число
   *  этого случая. Пробег `ink`/`bg`, не прошедший порог, разжалуется в
   *  `other` ЦЕЛИКОМ (не только «неплоские» пиксели внутри него) — иначе
   *  его плоский хвост (например, три случайно совпавших строки) остался
   *  бы засчитан и создал бы новый смежный пробег ровно той же природы. */
  const MIN_FLAT_STREAK = 6;
  interface RawRun { kind: 'ink' | 'bg' | 'other'; start: number; len: number }
  const rawRuns: RawRun[] = [];
  for (let i = 0; i < rawKinds.length; i++) {
    const k = rawKinds[i];
    const last = rawRuns[rawRuns.length - 1];
    if (last && last.kind === k) last.len += 1;
    else rawRuns.push({ kind: k, start: i, len: 1 });
  }
  const longestIdenticalStreak = (start: number, len: number): number => {
    let best = 1;
    let cur = 1;
    for (let i = start + 1; i < start + len; i++) {
      const a = rows[i - 1];
      const b = rows[i];
      if (a.r === b.r && a.g === b.g && a.b === b.b) { cur += 1; best = Math.max(best, cur); }
      else cur = 1;
    }
    return best;
  };
  const kinds: ('ink' | 'bg' | 'other')[] = new Array(rawKinds.length);
  for (const run of rawRuns) {
    const flat = run.kind === 'other' || longestIdenticalStreak(run.start, run.len) >= MIN_FLAT_STREAK;
    const effective = flat ? run.kind : 'other';
    for (let i = run.start; i < run.start + run.len; i++) kinds[i] = effective;
  }

  const runs: { kind: 'ink' | 'bg'; len: number }[] = [];
  for (const k of kinds) {
    if (k === 'other') continue; // постороннее содержимое — не в счёт (см. JSDoc функции)
    if (runs.length && runs[runs.length - 1].kind === k) runs[runs.length - 1].len += 1;
    else runs.push({ kind: k, len: 1 });
  }
  return runs.filter((r) => r.len >= 3);
}

/** Островок чернил после первого разрыва — паттерн `ink, bg, ink` (или
 *  длиннее) в отфильтрованных прогонах. Одиночный `ink → bg` (упавшая
 *  кромка) и одиночный `bg` (стык ещё не дорисован ни с одной стороны) —
 *  оба законны. */
function hasStrandedInk(runs: { kind: 'ink' | 'bg'; len: number }[]): boolean {
  let sawInk = false;
  let sawBgAfterInk = false;
  for (const r of runs) {
    if (r.kind === 'ink') {
      if (sawBgAfterInk) return true; // второй островок чернил
      sawInk = true;
    } else if (sawInk) {
      sawBgAfterInk = true;
    }
  }
  return false;
}

test.describe('линия на фоне — оторванный кусок линии не возвращается (05-line.md, D-080)', () => {
  for (const width of [768, 1440, 1920]) {
    for (const [themeLabel, colorScheme] of [['светлая', 'light'], ['тёмная', 'dark']] as const) {
      test(`${width}px, тема «${themeLabel}»: ни на одном стыке нет второго островка чернил`, async ({ browser }) => {
        const ctx = await browser.newContext({
          reducedMotion: 'no-preference',
          colorScheme,
          viewport: { width, height: 900 },
        });
        const page = await ctx.newPage();
        await page.goto('/');
        await page.waitForTimeout(1600); // line-load героя (раздел 7.4 брифа)

        const points = await stitches(page);
        expect(points.length, 'стыки не найдены').toBeGreaterThanOrEqual(9);
        const ink = await inkReference(page);

        // Несколько прокруток на стык — от «стык у самого верха вьюпорта»
        // (там дефект нашло дизайн-ревью, раздел «Дефект» задачи) до «стык
        // у самого низа», шагом ~0,15 вьюпорта — покрывает и состояние покоя
        // нижней шторки ДО её окна, и её проворот ВНУТРИ окна.
        const FRACTIONS = [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95];
        const failures: string[] = [];
        for (const s of points) {
          for (const f of FRACTIONS) {
            const scrollTarget = s.y - f * 900;
            const runs = await scanStitch(page, s.x, s.y, s.bg, ink, scrollTarget);
            if (hasStrandedInk(runs)) {
              failures.push(
                `${s.label} (x=${s.x.toFixed(0)}, y=${s.y.toFixed(0)}, прокрутка=${scrollTarget.toFixed(0)}): ${JSON.stringify(runs)}`,
              );
              break; // одной провалившейся прокрутки на стык достаточно
            }
          }
        }
        expect(failures, `оторванный кусок линии на стыках: ${failures.join('; ')}`).toEqual([]);

        await ctx.close();
      });
    }
  }
});

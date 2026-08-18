import { test, expect } from '@playwright/test';

/** Дефект 1, design-ревью 2026-08-19: «тёмные капсулы на каждом стыке».
 *  Причина найдена точно: раздел 3, Г-2 брифа `05-line.md` требует
 *  выносить оба конца КАЖДОГО пути за `viewBox` на ≥60 единиц
 *  (`linePaths.ts`, `OVERHANG`), чтобы спрятать круглый торец
 *  `stroke-linecap: round`. Вынос нижнего пути (~71px на экране при
 *  типичном масштабе коробки) красит полосу ВНУТРИ следующей секции — там
 *  же, где верхний вынос следующего пути красит полосу внутри предыдущей,
 *  и в промежутке между ними каждая секция и так ведёт линию через
 *  собственную полную высоту. Оба пути кроют один физический пиксель
 *  полупрозрачным `--accent`, альфа складывается дважды: замер design-
 *  ревью — контраст капсулы 1,409/1,594 против 1,194/1,251 у линии в
 *  остальной части прогона, на всех десяти стыках, длина капсулы 180–181px.
 *
 *  Сторож — прямое измерение того же рода, что видел ревьюер: цвет
 *  прорисованной линии В ТОЧКЕ СТЫКА двух секций обязан совпадать с цветом
 *  той же линии в середине прогона (там, где перекрытия выносов нет).
 *  Метод — реальный скриншот страницы (не синтетический canvas: важно
 *  измерить именно то, что складывает браузер при композиции ДВУХ разных
 *  `<svg>`, а не поведение одного пути в изоляции), затем декодирование
 *  PNG средствами самого браузера (`Image` → `<canvas>` → `getImageData`) —
 *  библиотека для чтения PNG в проекте не заведена и не нужна.
 *
 *  Пара для замера — `hero`/`pain`: обе секции ведут линию прямой
 *  (`straightPath`, раздел 4.3: «прямая, левый причал») на одном и том же
 *  доке (`x=59`), стык между ними — чистый вертикальный шов без кривой
 *  рядом. `pain` — секция минимальной высоты среди прямых (663px), поэтому
 *  контрольная точка «середина прогона» берётся ВНУТРИ неё, подальше от
 *  обеих её собственных полос выноса (стык с `hero` сверху и с `services`
 *  снизу — раздел 3, Г-2: полоса выноса ≈71px с каждой стороны стыка). */

const STROKE_WIDTH_VB = 34;
const OVERHANG_VB = 60;

async function readPixel(
  page: import('@playwright/test').Page,
  x: number,
  y: number,
): Promise<[number, number, number]> {
  const scrollY = await page.evaluate((targetY: number) => {
    const target = Math.max(0, targetY - 200);
    window.scrollTo(0, target);
    return window.scrollY;
  }, y);
  const size = 24;
  const viewportX = x - size / 2;
  const viewportY = y - scrollY - size / 2;
  const buffer = await page.screenshot({
    clip: { x: viewportX, y: viewportY, width: size, height: size },
  });
  const base64 = buffer.toString('base64');
  return page.evaluate(async (b64: string) => {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('не удалось декодировать снимок стыка'));
      img.src = `data:image/png;base64,${b64}`;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    // Среднее по центральному пятну 8×8 — гасит суб-пиксельное сглаживание
    // на краю штриха, не гасит саму капсулу (она шириной ~180px, много
    // больше пятна замера).
    const patch = 8;
    const ox = Math.floor((canvas.width - patch) / 2);
    const oy = Math.floor((canvas.height - patch) / 2);
    const data = ctx.getImageData(ox, oy, patch, patch).data;
    let r = 0;
    let g = 0;
    let b = 0;
    const n = patch * patch;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    return [r / n, g / n, b / n] as [number, number, number];
  }, base64);
}

async function measureGeometry(page: import('@playwright/test').Page) {
  return page.evaluate(
    ({ strokeWidthVb, overhangVb }) => {
      const hero = document.getElementById('hero');
      const pain = document.getElementById('pain');
      const painPath = pain?.querySelector('.line path') as SVGPathElement | null;
      const painSvg = painPath?.closest('svg') as SVGSVGElement | null;
      if (!hero || !pain || !painPath || !painSvg) return null;

      const heroRect = hero.getBoundingClientRect();
      const painRect = painSvg.getBoundingClientRect();
      const vb = painSvg.viewBox.baseVal;
      const scaleX = vb.width > 0 ? painRect.width / vb.width : 1;
      const scaleY = vb.height > 0 ? painRect.height / vb.height : 1;

      const d = painPath.getAttribute('d') || '';
      const nums = (d.match(/-?\d+\.?\d*/g) || []).map(Number);
      const dockXvb = nums[0];
      const dockXpx = painRect.left + dockXvb * scaleX;

      // Стык — низ `hero` (совпадает с верхом `pain`, раздел 11, п.3:
      // допуск ±2px). Документные координаты: обе секции читаются при
      // scrollY=0 (тест не скроллит до этого момента).
      const stitchY = heroRect.bottom + window.scrollY;

      // Середина прогона `pain` — подальше от ОБЕИХ её полос выноса
      // (стык с hero сверху, стык с services снизу), запас с большим
      // множителем сверх измеренной полосы ~71px.
      const overhangPx = overhangVb * scaleY;
      const painTop = painRect.top + window.scrollY;
      const painBottom = painTop + painRect.height;
      const midY = (painTop + painBottom) / 2;
      const safeMargin = overhangPx * 2;

      return {
        dockXpx,
        stitchY,
        midY,
        painTop,
        painBottom,
        safeMargin,
        strokeWidthPx: strokeWidthVb * scaleX,
      };
    },
    { strokeWidthVb: STROKE_WIDTH_VB, overhangVb: OVERHANG_VB },
  );
}

test.describe('линия на фоне — цвет на стыке равен цвету в середине прогона (05-line.md, дефект 1 «капсулы»)', () => {
  for (const [themeLabel, colorScheme] of [
    ['светлая', 'light'],
    ['тёмная', 'dark'],
  ] as const) {
    test(`тема «${themeLabel}»: стык hero/pain не темнее линии в середине pain`, async ({ browser }) => {
      const ctx = await browser.newContext({
        reducedMotion: 'reduce',
        colorScheme,
        viewport: { width: 1440, height: 900 },
      });
      const page = await ctx.newPage();
      await page.goto('/');

      const geometry = await measureGeometry(page);
      expect(geometry, 'не удалось измерить геометрию стыка hero/pain').not.toBeNull();
      const { dockXpx, stitchY, midY, painTop, painBottom, safeMargin } = geometry!;

      expect(
        midY - painTop,
        `середина pain (${(midY - painTop).toFixed(0)}px от верха) слишком близко к стыку с hero`,
      ).toBeGreaterThan(safeMargin);
      expect(
        painBottom - midY,
        `середина pain (${(painBottom - midY).toFixed(0)}px до низа) слишком близко к стыку с services`,
      ).toBeGreaterThan(safeMargin);

      const stitchColor = await readPixel(page, dockXpx, stitchY);
      const midColor = await readPixel(page, dockXpx, midY);

      const diff = stitchColor.map((v, i) => Math.abs(v - midColor[i]));
      const maxDiff = Math.max(...diff);
      // eslint-disable-next-line no-console
      console.log(
        `${themeLabel}: стык rgb(${stitchColor.map((v) => Math.round(v))}), ` +
        `середина rgb(${midColor.map((v) => Math.round(v))}), макс. разница по каналу ${maxDiff.toFixed(1)}`,
      );

      expect(
        maxDiff,
        `цвет на стыке rgb(${stitchColor.map((v) => Math.round(v))}) темнее середины прогона ` +
        `rgb(${midColor.map((v) => Math.round(v))}) — двойное альфа-смешение в выносе путей (капсула)`,
      ).toBeLessThanOrEqual(4);

      await ctx.close();
    });
  }
});

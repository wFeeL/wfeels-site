import { test, expect } from '@playwright/test';

/** Сторож «оторванного куска линии» (дизайн-ревью 2026-08-21, задача
 *  «пролагивает при листании», D-080) — **переписан 2026-08-22** по правке
 *  того же класса дефекта, но со ВТОРОЙ причиной: снимки владельца снова
 *  показали оторванный кусок, теперь потому, что окна раскрытия соседних
 *  секций (`animation-range`, раздел 7.3 брифа `05-line.md`) перекрывались —
 *  `.line-curtain{ animation-timeline: view() }` брала источником таймлайна
 *  саму себя, а её бокс растянут `CAP_OVERHANG` сверх бокса секции.
 *  Починка — `BackgroundLine.astro`, именованный `view-timeline-name` на
 *  `[data-line-side]`.
 *
 *  ПРЕЖНЯЯ версия этого сторожа (пиксельный срез вертикальной колонки на
 *  доке линии) была зелёной, пока дефект стоял на экране, по ДВУМ причинам,
 *  обе устранены здесь:
 *
 *  1. она сканировала ТОЛЬКО стыки секций (окно ±350px вокруг `y`,
 *     несколько фиксированных долей вьюпорта) — дефект живёт в СЕРЕДИНЕ
 *     диапазона перекрытия, который может стоять не ровно на стыке;
 *  2. она проверяла ширины 768/1440/1920 — дефект воспроизводится на
 *     1000 и 1100 (плотный скан владельца, шаг 60px по прокрутке).
 *
 *  Метод ниже — ГЕОМЕТРИЧЕСКИЙ, не пиксельный (раздел «Что сделать» задачи:
 *  «годится и геометрический способ, он дешевле пиксельного и поймал дефект
 *  у меня»): для каждой секции видимые чернила = бокс её `.line` (`<svg>`)
 *  минус часть, закрытая ЕЁ ЖЕ шторкой (`.line-curtain`, верхняя кромка —
 *  `getBoundingClientRect().top`, дальше вниз шторка ещё не раскрыта).
 *  Интервалы всех секций сливаются (порог склейки `MERGE_GAP = 6px`, тот же
 *  порядок величины, что несёт брифовый допуск стыков, раздел 11 п.3:
 *  ±2px, — здесь чуть шире, потому что мера не пиксельная, а геометрическая
 *  и по построению точнее пиксельного среза, но округление `getBoundingClientRect`
 *  и суб-пиксельные позиции `scaleY` дают единицы px шума). В окне вьюпорта
 *  обязан быть РОВНО ОДИН непрерывный кусок (или ноль — до первого мазка/
 *  после хвоста подвала), два и больше — оторванный кусок. */

const WIDTHS = [390, 768, 900, 1000, 1100, 1180, 1280, 1440, 1920];
/** Высота вьюпорта скана — та же, которой владелец поймал дефект
 *  (1000×1000/1100×1000), фиксирована на всех девяти ширинах, чтобы число
 *  прогонов оставалось предсказуемым и результат — сравнимым между шириной. */
const SCAN_HEIGHT = 1000;
/** Шаг прокрутки — не больше 60px (условие задачи). */
const SCROLL_STEP = 60;
/** Порог склейки соседних чернильных интервалов — не больше 6px (условие задачи). */
const MERGE_GAP = 6;

interface Interval { top: number; bottom: number }

/** Читает для каждой секции с линией видимый интервал чернил в координатах
 *  ВЬЮПОРТА (не документа — сравнение идёт внутри одного снимка прокрутки,
 *  абсолютная привязка не нужна). Шторка сжимается от НИЖНЕГО края
 *  (`transform-origin: bottom`, раздел 7.1 брифа): по мере раскрытия её
 *  верхняя кромка (`curtainRect.top`) уходит вниз от верха бокса секции к
 *  его низу — всё, что выше этой кромки (и внутри бокса `.line`), уже
 *  нарисовано. */
async function inkIntervals(page: import('@playwright/test').Page): Promise<Interval[]> {
  return page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('[data-line-side]')) as HTMLElement[];
    const out: { top: number; bottom: number }[] = [];
    for (const sec of sections) {
      const svg = sec.querySelector('.line') as SVGElement | null;
      const curtain = sec.querySelector('.line-curtain') as HTMLElement | null;
      if (!svg || !curtain) continue;
      const svgRect = svg.getBoundingClientRect();
      const curtainRect = curtain.getBoundingClientRect();
      const inkTop = svgRect.top;
      const inkBottom = Math.min(Math.max(curtainRect.top, svgRect.top), svgRect.bottom);
      if (inkBottom - inkTop > 0.5) out.push({ top: inkTop, bottom: inkBottom });
    }
    return out;
  });
}

/** Сливает интервалы, отсортированные по `top`, с порогом склейки `gap`. */
function mergeIntervals(intervals: readonly Interval[], gap: number): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.top - b.top);
  const merged: Interval[] = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    if (last && iv.top <= last.bottom + gap) {
      last.bottom = Math.max(last.bottom, iv.bottom);
    } else {
      merged.push({ ...iv });
    }
  }
  return merged;
}

test.describe('линия на фоне — плотный скан: окна раскрытия соседних секций встык (05-line.md)', () => {
  for (const width of WIDTHS) {
    test(`${width}×${SCAN_HEIGHT}: ни одной позиции прокрутки с двумя кусками чернил в вьюпорте`, async ({ browser }) => {
      test.setTimeout(300_000);
      const ctx = await browser.newContext({
        reducedMotion: 'no-preference',
        viewport: { width, height: SCAN_HEIGHT },
      });
      const page = await ctx.newPage();
      await page.goto('/');
      await page.waitForTimeout(1600); // line-load героя (раздел 7.4 брифа), 1400ms + запас

      const maxScroll = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      );

      // Ниже порога рисунка (480px, раздел 6/8 брифа) линии нет в разметке
      // вовсе — сканировать нечего, это законное «ноль кусков всегда».
      if (width < 480) {
        expect(maxScroll).toBeGreaterThan(0); // страница всё равно прокручивается
        await ctx.close();
        return;
      }

      expect(maxScroll, 'страница не прокручивается — сканировать нечего').toBeGreaterThan(100);

      const stops = new Set<number>();
      for (let y = 0; y <= maxScroll; y += SCROLL_STEP) stops.add(y);
      stops.add(maxScroll); // низ страницы — хвост подвала, шаг может не попасть точно

      const failures: string[] = [];
      for (const y of Array.from(stops).sort((a, b) => a - b)) {
        await page.evaluate((sy) => window.scrollTo(0, sy), y);
        // Скролл-таймлайн пересчитывается на кадре компоновки, не синхронно
        // со `scrollTo()` (та же ловушка, что и у `background-line.spec.ts`,
        // «ровно один элемент в промежуточном состоянии»): ждём два кадра.
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        const intervals = await inkIntervals(page);
        const merged = mergeIntervals(intervals, MERGE_GAP);
        // Считаем только куски, реально попадающие в текущий вьюпорт —
        // дефект («оторванный кусок») это то, что видно на экране, а не то,
        // что произошло где-то за его пределами (раздел 11: «непрерывность
        // проверяется по чернилам на экране»).
        const visible = merged.filter((m) => m.bottom > 0 && m.top < SCAN_HEIGHT);
        if (visible.length > 1) {
          failures.push(
            `прокрутка ${y}: ${visible.length} кусков — ` +
              JSON.stringify(visible.map((v) => [Math.round(v.top), Math.round(v.bottom)])),
          );
        }
      }

      expect(
        failures,
        `оторванный кусок линии на ${width}px (первые до 10 позиций): ${failures.slice(0, 10).join('; ')}` +
          (failures.length > 10 ? ` … и ещё ${failures.length - 10}` : ''),
      ).toEqual([]);

      await ctx.close();
    });
  }
});

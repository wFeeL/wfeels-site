import { test, expect } from '@playwright/test';

/** Сторож протяжённости и непрерывности линии — **переписан целиком**
 *  `2026-08-27` под сквозную шкалу (`70-workshop/specs/site-v3/
 *  15-line-through-scale-brief.md`, раздел 7, П-Э1…П-Э4).
 *
 *  ГЛАВНАЯ ОШИБКА, которую закрывает эта версия (раздел 1 брифа, «главная
 *  ошибка дня»): прежний сторож (этот же файл, до правки) сливал интервалы
 *  видимых чернил всех секций и требовал «в окне вьюпорта РОВНО ОДИН
 *  непрерывный кусок» — свойство НЕПРЕРЫВНОСТИ. Линия, голова которой
 *  просто ПАРКУЕТСЯ на середине экрана (не движется вместе с прокруткой),
 *  даёт ровно один непрерывный кусок — ноль разрывов — и была ЗЕЛЁНОЙ,
 *  пока дефект стоял на экране. Сторож не мерил ни одним числом
 *  ПРОТЯЖЁННОСТЬ — где именно останавливается голова. Четыре пункта ниже
 *  ловят четыре разных способа соврать.
 *
 *  МЕТОД. Сквозная шторка (`BackgroundLine.astro`) фиксирована к окну:
 *  `top: var(--line-head)`. Она красит ОДНИМ и тем же непрозрачным `--bg`
 *  всё, что ниже этой линии, поэтому видимые чернила КАЖДОГО пути —
 *  геометрическая разница между рендерным боксом самого `<path>` (реальная
 *  геометрия на экране, `getBoundingClientRect()` — включает вынос
 *  `OVERHANG` за пределы `viewBox`, `overflow: visible`) и линией головы.
 *  Тот же геометрический приём, что уже был в этом файле до правки
 *  («дешевле пиксельного и ловит дефект»), применён к НОВОЙ механике:
 *  раньше «своя шторка» была у каждой секции и её `top` считался от
 *  `view()`-прогресса; теперь шторка ОДНА и её `top` — константа
 *  `getBoundingClientRect().top` самого `.line-curtain`.
 *
 *  ЛОВУШКА 31 (`50-code/CLAUDE.md`) обязательна: полностраничный снимок
 *  обнуляет прокруточные состояния — весь замер идёт ПОЛОСАМИ, снимком
 *  видимой части окна на настоящей позиции прокрутки, без `fullPage`. */

const WIDTHS = [900, 1180, 1440, 1920] as const;
const SCAN_HEIGHT = 900;
const SCROLL_STEP = 250; // раздел 0 брифа: «шагом не крупнее 250 px».

/** Девять секций главной, идущих подряд (десять секций, девять стыков) —
 *  раздел 7 брифа, П-Э4. Список — не второй перечень секций, а порядок,
 *  выведенный из `lib/sections.ts` (единственный источник состава),
 *  прочитанный прямо из DOM `data-line-side`-секций на живой странице
 *  (см. `orderedSectionIds` ниже) — не вписан руками.
 *  (Ловушка 15/21/24, `50-code/CLAUDE.md`.) */

/** Известный зазор 480…899px между `faq` и `contact` (`.mobile-cta-range`
 *  резервирует `--mobile-cta-bar-h` в потоке) — ГЕОМЕТРИЯ путей, не
 *  раскрытие; не тронута этим брифом (раздел 6.4: «остаётся и меняет
 *  природу», решение владельца не получено). Сканы этого файла идут по
 *  ширинам ≥ 900px — зазор туда не попадает, запись не нужна. */

interface InkSample {
  inkBottom: number | null; // null — путь нигде не пересекает полосу головы
  curtainTop: number;
  /** `true`, если краска НА ЭТОМ ШАГЕ действительно ограничена головой
   *  (какой-то путь физически продолжается НИЖЕ головы, и голова его
   *  обрезает) — «рисование в процессе». `false` — голова уже прошла ВЕСЬ
   *  рисунок, который вообще есть на экране (путь кончается сам, раньше
   *  головы: последний штрих `contact`, приёмка П-Ф1 отдельного файла) —
   *  законное состояние конца рассказа, не парковка. П-Э1/П-Э2 применяются
   *  только пока `capped === true` — тем же способом, каким раздел 9 брифа
   *  `05-line` оговаривал «до первого мазка / после хвоста» как законные
   *  «ноль кусков», перенесённым на новую механику. */
  capped: boolean;
}

/** Читает состояние чернил на ТЕКУЩЕЙ позиции прокрутки — метод из шапки
 *  файла. `curtainTop` — экранная линия головы (константа для всей
 *  страницы на этой ширине/высоте окна). `inkBottom` — максимум по всем
 *  путям, чей рендерный бокс хоть немного заходит выше головы (там есть
 *  нарисованная краска), от нижней кромки этого бокса, зажатой сверху
 *  линией головы (краска физически не может быть видна ниже неё — куртина
 *  красит сплошным цветом) и снизу нулём (не выше верхней кромки окна). */
async function readInkSample(page: import('@playwright/test').Page): Promise<InkSample> {
  return page.evaluate(() => {
    const curtain = document.querySelector('.line-curtain') as HTMLElement;
    const curtainTop = curtain.getBoundingClientRect().top;
    const vh = window.innerHeight;
    const sections = Array.from(document.querySelectorAll('[data-line-side]'));
    let inkBottom: number | null = null;
    let capped = false;
    for (const sec of sections) {
      const path = sec.querySelector('svg.line > path:not(.line-branch):not(.line-head)');
      if (!path) continue;
      const r = (path as SVGPathElement).getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= vh) continue; // не в кадре вовсе
      if (r.top >= curtainTop) continue; // весь путь ещё ниже головы — краски здесь нет
      const bottom = Math.min(r.bottom, curtainTop);
      const clipped = Math.min(Math.max(bottom, 0), vh);
      if (inkBottom === null || clipped > inkBottom) {
        inkBottom = clipped;
        // «В процессе» — если РЕАЛЬНАЯ (не обрезанная головой) нижняя
        // кромка этого пути лежит НИЖЕ головы: значит путь продолжается
        // дальше, а голова его физически обрывает. Если реальная кромка
        // уже ВЫШЕ головы — путь дорисован целиком сам по себе, головой
        // тут нечего резать (конец рассказа, не парковка).
        capped = r.bottom >= curtainTop - 0.5;
      }
    }
    return { inkBottom, curtainTop, capped };
  });
}

async function scrollAndWaitFrame(page: import('@playwright/test').Page, y: number) {
  await page.evaluate((sy) => window.scrollTo(0, sy), y);
  // Скролл-таймлайн/раскладка фиксированного элемента пересчитывается на
  // кадре компоновки, не синхронно со `scrollTo()` — ждём два кадра (тот же
  // приём, что уже стоит во всех сторожах линии этого репозитория).
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

test.describe('линия на фоне — сквозная шкала: П-Э1/П-Э2/П-Э3 (протяжённость и монотонность головы)', () => {
  for (const width of WIDTHS) {
    test(`${width}×${SCAN_HEIGHT}: голова стоит на --line-head и идёт вровень с прокруткой`, async ({ browser }) => {
      test.setTimeout(120_000);
      const ctx = await browser.newContext({
        reducedMotion: 'no-preference',
        viewport: { width, height: SCAN_HEIGHT },
      });
      const page = await ctx.newPage();
      await page.goto('/');
      await page.waitForTimeout(1600); // line-load героя (раздел 2.6 брифа), 1400ms + запас

      const { maxScroll, lineHead, nib } = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const probe = document.createElement('div');
        probe.style.position = 'fixed';
        probe.style.top = 'var(--line-head)';
        probe.style.visibility = 'hidden';
        document.body.appendChild(probe);
        const head = probe.getBoundingClientRect().top;
        probe.style.top = 'var(--line-nib)';
        const nibValue = probe.getBoundingClientRect().top; // top:0 base, --line-nib as length from 0
        probe.remove();
        return {
          maxScroll: document.documentElement.scrollHeight - window.innerHeight,
          lineHead: head,
          nib: nibValue,
        };
      });
      expect(maxScroll, 'страница не прокручивается — сканировать нечего').toBeGreaterThan(300);

      const stops = new Set<number>();
      for (let y = 0; y <= maxScroll; y += SCROLL_STEP) stops.add(y);
      stops.add(maxScroll);
      const ys = Array.from(stops).sort((a, b) => a - b);

      const samples: { y: number; sample: InkSample }[] = [];
      for (const y of ys) {
        await scrollAndWaitFrame(page, y);
        const sample = await readInkSample(page);
        samples.push({ y, sample });
      }
      await ctx.close();

      // Голова — экранная константа: curtainTop не должен меняться со
      // scrollY (это и есть «сквозная шкала», раздел 2.1 брифа).
      for (const { y, sample } of samples) {
        expect(sample.curtainTop, `${width}px, scrollY=${y}: top шторки сместился от --line-head`).toBeCloseTo(lineHead, 0);
      }

      // П-Э1. Голова стоит там, где сказано — на каждом шаге, где путь
      // вообще пересекает полосу головы (inkBottom !== null) И голова
      // реально обрезает продолжающийся путь (`capped`, а не законный конец
      // рассказа — см. JSDoc `InkSample.capped`).
      const LOWER = lineHead - 24;
      const UPPER = lineHead + nib + 8;
      const outOfRange = samples.filter(
        ({ sample }) => sample.inkBottom !== null && sample.capped && (sample.inkBottom < LOWER || sample.inkBottom > UPPER),
      );
      expect(
        outOfRange,
        `${width}px: inkBottom вне [${LOWER.toFixed(1)}, ${UPPER.toFixed(1)}] на: ` +
          outOfRange.map((s) => `${s.y}px(${s.sample.inkBottom?.toFixed(1)})`).join(', '),
      ).toEqual([]);

      // П-Э2. Голова идёт вровень с прокруткой — inkBottom_doc = scrollY +
      // inkBottom обязан быть неубывающим, приращение ≈ шаг ± 8px, на всём
      // протяжении, где голова реально обрезает путь (`capped`): once путь
      // дорисован целиком раньше головы (конец рассказа, П-Ф1), его
      // document-положение по построению перестаёт расти вместе с
      // прокруткой — это не парковка, а завершение, отдельно проверяемое
      // `background-line-footer-reach.spec.ts`.
      const withDoc = samples
        .filter((s) => s.sample.inkBottom !== null && s.sample.capped)
        .map((s) => ({ y: s.y, doc: s.y + (s.sample.inkBottom as number) }));

      const violations: string[] = [];
      for (let i = 1; i < withDoc.length; i++) {
        const prev = withDoc[i - 1];
        const cur = withDoc[i];
        const step = cur.y - prev.y;
        const delta = cur.doc - prev.doc;
        if (delta < -0.5) {
          violations.push(`откат на ${cur.y}px: doc ${prev.doc.toFixed(1)} → ${cur.doc.toFixed(1)}`);
          continue;
        }
        // Приращение обязано быть ≈ шагу прокрутки ± 8px — но только когда
        // шаг между выборками совпадает с обычным SCROLL_STEP (последняя
        // пара может быть короче — `maxScroll` не кратен шагу).
        if (step === SCROLL_STEP && Math.abs(delta - step) > 8) {
          violations.push(`шаг ${prev.y}→${cur.y}: приращение doc=${delta.toFixed(1)}, ожидалось ${step}±8`);
        }
      }
      expect(violations, `${width}px: голова не идёт вровень с прокруткой: ${violations.join('; ')}`).toEqual([]);

      // П-Э3. Под головой краски нет — геометрическая часть: ни один
      // рендерный бокс пути не даёт inkBottom выше верхней границы допуска
      // (уже проверено в П-Э1 через UPPER), плюс прямой пиксельный замер
      // ниже (отдельный тест) на реальной странице.
    });
  }
});

test.describe('линия на фоне — сквозная шкала: П-Э3 (под головой краски нет, пиксельный замер)', () => {
  /* ПЕРВАЯ РЕДАКЦИЯ этого теста сравнивала точку СЛУЧАЙНО выбранную поперёк
   * холста (доля ширины 0,05…0,95) на середине документа с точкой ЗА
   * холстом — и была недостоверна ПО ТОЙ ЖЕ причине, что уже задокументирована
   * ловушкой 26 (`50-code/CLAUDE.md`, «состояние, которого нет в сборке, не
   * меряется косвенно»): середина документа — это обычный контент секции
   * (карточки, фото, текст), а не чистый фон, и сравнение упало на реальном
   * пикселе фотографии/карточки, а не на утечке линии («89,7,47» — цвет
   * содержимого, не линии). Правка — целиться ТОЧНО в геометрию пути
   * (`process`, прямая на левом доке, `DOCK_LEFT=59` единиц `viewBox`),
   * читая её масштаб из `getBoundingClientRect()`/`viewBox`, тем же приёмом,
   * что уже использует `background-line-narrator.spec.ts` (`toPagePoint`,
   * тест П-21) — а не долей ширины холста. */
  test('1440×900: точка на доке process, 40px ниже головы+ниба, даёт цвет --bg, не краску линии', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(1600);

    // Прокрутить так, чтобы голова стояла на 150px НИЖЕ верхней кромки
    // `#process` (секция «Как я работаю» — прямая по левому доку на всю
    // высоту, `linePaths.ts`, `straightPath(h, DOCK_LEFT)`) — путь заведомо
    // продолжается ниже головы (секция ~1333px высотой), есть что резать.
    const setup = await page.evaluate(() => {
      const sec = document.querySelector('#process') as HTMLElement;
      const path = sec.querySelector('svg.line > path:not(.line-branch):not(.line-head)') as SVGPathElement;
      const svg = path.closest('svg') as SVGSVGElement;
      const secTopDoc = sec.getBoundingClientRect().top + window.scrollY;
      const curtain = document.querySelector('.line-curtain') as HTMLElement;
      const probe = document.createElement('div');
      probe.style.position = 'fixed';
      probe.style.visibility = 'hidden';
      probe.style.top = 'var(--line-head)';
      document.body.appendChild(probe);
      const lineHead = probe.getBoundingClientRect().top;
      probe.remove();
      const nibRaw = getComputedStyle(document.documentElement).getPropertyValue('--line-nib').trim();
      const nib = parseFloat(nibRaw) || 28;
      return { secTopDoc, lineHead, nib };
    });

    const scrollY = Math.max(0, Math.round(setup.secTopDoc + 150 - setup.lineHead));
    await scrollAndWaitFrame(page, scrollY);

    const point = await page.evaluate(() => {
      const sec = document.querySelector('#process') as HTMLElement;
      const path = sec.querySelector('svg.line > path:not(.line-branch):not(.line-head)') as SVGPathElement;
      const svg = path.closest('svg') as SVGSVGElement;
      const svgRect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const scaleX = vb.width > 0 ? svgRect.width / vb.width : 1;
      // Дока x=59 (DOCK_LEFT, `linePaths.ts`) — экранная X-координата дока.
      const screenX = svgRect.left + (59 - vb.x) * scaleX;
      const curtain = document.querySelector('.line-curtain') as HTMLElement;
      const curtainTop = curtain.getBoundingClientRect().top;
      const nibRaw = getComputedStyle(document.documentElement).getPropertyValue('--line-nib').trim();
      const nib = parseFloat(nibRaw) || 28;
      const screenY = curtainTop + nib + 40;
      // Ожидаемый фон — само computed значение `--bg` на этой странице (не
      // точка НА странице в другом месте, которая тоже может нести
      // произвольное декоративное оформление).
      const bg = getComputedStyle(document.body).backgroundColor || getComputedStyle(document.documentElement).backgroundColor;
      return { screenX, screenY, bg };
    });

    async function pixelAt(x: number, yy: number): Promise<string> {
      const buf = await page.screenshot({ clip: { x: Math.round(x) - 1, y: Math.round(yy) - 1, width: 3, height: 3 } });
      return page.evaluate(async (b64) => {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('decode failed'));
          img.src = `data:image/png;base64,${b64}`;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx2 = canvas.getContext('2d')!;
        ctx2.drawImage(img, 0, 0);
        const d = ctx2.getImageData(1, 1, 1, 1).data;
        return `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
      }, buf.toString('base64'));
    }

    const onDock = await pixelAt(point.screenX, point.screenY);
    expect(
      onDock,
      `на доке process под головой+нибом+40px цвет ${onDock}, ожидался фон ${point.bg} — краска линии протекает под шторкой`,
    ).toBe(point.bg);

    await ctx.close();
  });
});

test.describe('линия на фоне — сквозная шкала: П-Э4 (стыков секций как событий не существует)', () => {
  test('1440×900: на каждом из девяти стыков краска непрерывна 120px выше головы и отсутствует ниже', async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(1600);

    const { boundaries, lineHead, nib } = await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('main [data-line-side]')) as HTMLElement[];
      const tops = sections.map((s) => s.getBoundingClientRect().top + window.scrollY);
      // Стыки — верхние кромки секций 2..N (девять стыков на десять секций).
      const stitches = tops.slice(1);
      const curtain = document.querySelector('.line-curtain') as HTMLElement;
      const probe = document.createElement('div');
      probe.style.position = 'fixed';
      probe.style.visibility = 'hidden';
      probe.style.top = 'var(--line-head)';
      document.body.appendChild(probe);
      const head = probe.getBoundingClientRect().top;
      probe.remove();
      const nibRaw = getComputedStyle(document.documentElement).getPropertyValue('--line-nib').trim();
      return { boundaries: stitches, lineHead: head, nib: parseFloat(nibRaw) || 28 };
    });

    expect(boundaries.length, 'девять стыков на десять секций').toBe(9);

    const failures: string[] = [];
    for (const [i, boundaryDocY] of boundaries.entries()) {
      // Прокрутить так, чтобы стык стоял РОВНО на --line-head.
      const y = Math.max(0, Math.round(boundaryDocY - lineHead));
      await scrollAndWaitFrame(page, y);
      const sample = await readInkSample(page);

      if (sample.inkBottom === null) {
        failures.push(`стык ${i + 1}: нет ink вовсе на scrollY=${y}`);
        continue;
      }
      const LOWER = lineHead - 24;
      const UPPER = lineHead + nib + 8;
      if (sample.inkBottom < LOWER || sample.inkBottom > UPPER) {
        failures.push(`стык ${i + 1}: inkBottom=${sample.inkBottom.toFixed(1)} вне [${LOWER.toFixed(1)}, ${UPPER.toFixed(1)}]`);
      }

      // Непрерывность на 120px выше стыка: на каждой из шести проверочных
      // высот в полосе [head-120, head] должен найтись путь, чей рендерный
      // бокс её накрывает — иначе там разрыв.
      const checkYs = [0, 20, 40, 60, 80, 100, 120].map((d) => lineHead - d);
      const covered = await page.evaluate((ys) => {
        const sections = Array.from(document.querySelectorAll('[data-line-side]'));
        const paths = sections
          .map((sec) => sec.querySelector('svg.line > path:not(.line-branch):not(.line-head)'))
          .filter((p): p is SVGPathElement => Boolean(p))
          .map((p) => p.getBoundingClientRect());
        return ys.map((yy) => paths.some((r) => r.top <= yy && yy <= r.bottom));
      }, checkYs);
      if (covered.some((c) => !c)) {
        failures.push(
          `стык ${i + 1}: разрыв в полосе 120px выше головы на высотах ` +
            checkYs.filter((_, idx) => !covered[idx]).map((v) => Math.round(v)).join(', '),
        );
      }
    }

    await ctx.close();
    expect(failures, `П-Э4 нарушено: ${failures.join('; ')}`).toEqual([]);
  });
});

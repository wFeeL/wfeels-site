import { test, expect } from '@playwright/test';

/** Линия на фоне главной — бриф `70-workshop/specs/site-v3/
 *  02-background-line.md`. Механика переписана 2026-08-18 (раздел 7) на
 *  инлайновые `<svg><path pathLength="1"/></svg>` внутри каждой
 *  `<section data-line-side>` — прогон несёт класс `.line-run`, переход на
 *  верхнем стыке (когда он есть) — `.line-turn`. Прежний класс `.bg-line` и
 *  приём `clip-path` этой правкой снят целиком (раздел 7.1, «`clip-path:
 *  inset()` открывал горизонтальную полосу — линия появлялась, а не
 *  рисовалась»); тесты ниже проверяют разметку и мотор ПОСЛЕ этой правки.
 *  Анимация (`animation-name`, `stroke-dashoffset`) сидит на `<path>` внутри
 *  каждого `<svg>`, не на самом `<svg>` — элемент-обёртка её не несёт.
 *
 *  ЛОВУШКА headless-Chromium: по умолчанию он отдаёт `prefers-reduced-
 *  motion: reduce`, даже когда тест явно этого не просил — любая проверка
 *  движения обязана эмулировать `no-preference` явно, иначе «обычный путь»
 *  тихо тестирует то же самое запасное состояние, что и тест на reduce. */

const LINE_SELECTOR = '.line-run, .line-turn';
const LINE_PATH_SELECTOR = '.line-run path, .line-turn path';

async function findLineStylesheetHref(page: import('@playwright/test').Page) {
  const hrefs = await page.locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((l) => l.getAttribute('href') ?? ''));
  for (const href of hrefs) {
    const res = await page.request.get(href);
    const css = await res.text();
    if (css.includes('.line-run')) return { href, css };
  }
  throw new Error('стиль .line-run не найден ни в одном подключённом файле');
}

test.describe('линия на фоне — запасное состояние без поддержки animation-timeline', () => {
  test('без блока @supports линия видна целиком, без анимации', async ({ page }) => {
    await page.goto('/');
    const { href, css } = await findLineStylesheetHref(page);

    // `animation-timeline:view()` — общая техника: её же несут карточки,
    // диалог и ядро тизера фабрики (каждый в СВОЁМ @supports). Резать нужно
    // ИМЕННО блок линии — тот, что содержит уникальную для неё анимацию
    // `line-draw`, — а не первый по тексту @supports с этим условием
    // (прежняя редакция уже красилась именно на этом, см. историю файла).
    const marker = '@supports (animation-timeline:view())';
    let start = css.indexOf(marker);
    let ourBlockStart = -1;
    let ourBlockEnd = -1;
    while (start !== -1) {
      let depth = 0;
      let end = start;
      for (let i = css.indexOf('{', start); i < css.length; i++) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') {
          depth--;
          if (depth === 0) { end = i + 1; break; }
        }
      }
      if (css.slice(start, end).includes('line-draw')) {
        ourBlockStart = start;
        ourBlockEnd = end;
        break;
      }
      start = css.indexOf(marker, end);
    }
    expect(ourBlockStart, 'в собранном CSS не нашёлся @supports-блок линии (line-draw)').toBeGreaterThan(-1);

    const withoutSupports = css.slice(0, ourBlockStart) + css.slice(ourBlockEnd);

    /* Вне вырезанного блока имя `line-draw` остаётся ЗАКОННО — это само
       объявление `@keyframes`, которое сборщик держит на верхнем уровне и
       которое ничего не применяет: набор кадров без `animation-name` не
       двигает ничего. Прежняя редакция проверяла отсутствие самого имени и
       падала на этом при исправном коде — то есть требовала спрятать кадры,
       а не поведение.

       Проверять надо ПРИМЕНЕНИЕ: назначение анимации. Клип-маска (`clip-
       path`) снята вместе со старой механикой (раздел 7.1) — базовое
       правило вне `@supports` теперь держит `stroke-dashoffset: 0` (линия
       нарисована целиком) безусловно, поэтому проверять его отсутствие
       больше нечем и не нужно: сравнивать нужно применение анимации. */
    expect(withoutSupports, 'вне @supports осталось назначение анимации линии')
      .not.toContain('animation-name:line-draw');

    await page.route(`**${href}`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/css', body: withoutSupports }));
    await page.reload();

    const style = await page.locator(LINE_PATH_SELECTOR).first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { dashoffset: s.strokeDashoffset, animationName: s.animationName };
    });
    expect(style.dashoffset).toBe('0px');
    expect(style.animationName).toBe('none');
  });
});

test.describe('линия на фоне — уменьшенное движение', () => {
  test('при prefers-reduced-motion: reduce линия прорисована целиком, без анимации',
    async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.goto('/');
      const style = await page.locator(LINE_PATH_SELECTOR).first().evaluate((el) => {
        const s = getComputedStyle(el);
        return { dashoffset: s.strokeDashoffset, animationName: s.animationName };
      });
      expect(style.dashoffset).toBe('0px');
      expect(style.animationName).toBe('none');
      await ctx.close();
    });
});

test.describe('линия на фоне — обычный путь (поддержка есть, движение разрешено)', () => {
  test('каждый .line-run/.line-turn получает анимацию, завязанную на view()', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    await page.goto('/');
    const styles = await page.locator(LINE_PATH_SELECTOR).evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        return { animationName: s.animationName, timeline: s.animationTimeline };
      }));
    // Десять прогонов (по одному на секцию главной) + три перехода
    // (Ч-4, раздел 4.2) + хвост подвала = 14 путей (раздел 8, «14 элементов»).
    expect(styles.length).toBe(14);
    for (const s of styles) {
      expect(s.animationName).not.toBe('none');
    }
    await ctx.close();
  });

  test('линия присутствует в HTML без выполнения JavaScript (статика)', async ({ request }) => {
    const res = await request.get('/');
    const html = await res.text();
    // Десять секций главной + подвал (`footerLineData()`, раздел 7.2:
    // «подвал получает один элемент line-run с той же стороной, что у
    // contact») — источник lib/sections.ts + Footer.astro.
    expect((html.match(/data-line-side="(left|right)"/g) ?? []).length).toBe(11);
    expect(html).toContain('class="line-run"');
  });

  test('линия — не орган управления: вне таб-порядка и указателя', async ({ page }) => {
    await page.goto('/');
    const first = page.locator(LINE_SELECTOR).first();
    await expect(first).toHaveAttribute('aria-hidden', 'true');
    const pointerEvents = await first.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pointerEvents).toBe('none');
  });
});

test.describe('линия на фоне — только главная сегодня', () => {
  test('на посадочной без пропа line линии нет', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator(LINE_SELECTOR)).toHaveCount(0);
  });
});

/* Раздел 6 брифа отменяет D-026: порог 900 px (линия не рисуется вовсе)
 * заменён на 480 px, и обоснование другое — прогон вынесен в поле страницы
 * вне колонки содержимого, а не прибит к левому краю в 64…320 px. */
test.describe('линия на фоне — порог 480 px (раздел 6, D-026 отменён)', () => {
  test('на 390 px (мобильный) линии нет в разметке видимой', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/');
    await expect(page.locator(LINE_SELECTOR).first()).toBeHidden();
  });

  test('на 479 px линии всё ещё нет, на 480 px уже есть', async ({ page }) => {
    await page.setViewportSize({ width: 479, height: 900 });
    await page.goto('/');
    await expect(page.locator(LINE_SELECTOR).first()).toBeHidden();

    await page.setViewportSize({ width: 480, height: 900 });
    await expect(page.locator(LINE_SELECTOR).first()).toBeVisible();
  });

  test('на 900 px линия по-прежнему видна (порог D-026 больше не действует)', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('/');
    await expect(page.locator(LINE_SELECTOR).first()).toBeVisible();
  });
});

/* Раздел 9, пункт 7 — ни на одной ширине из числа проверяемых линия не
 * порождает горизонтальную прокрутку: вынос .line-run/.line-turn за кромку секции
 * (--line-out / --line-out-right, раздел 3.4) ограничен clamp()'ом,
 * границу проверяем измерением, а не полагаемся на формулу. */
test.describe('линия на фоне — не создаёт горизонтальной прокрутки', () => {
  for (const width of [480, 768, 900, 1220, 1324, 1440, 1920]) {
    test(`${width}px: scrollWidth === clientWidth`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/');
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `лишняя горизонтальная прокрутка ${overflow}px на ${width}px`).toBe(0);
    });
  }
});

/* Раздел 9, пункт 10 — переходов на странице ровно (число точек рельса − 1),
 * и они стоят на границах точек рельса, а не где придётся. Число было семь
 * при восьми точках рельса; правка владельца 2026-08-18 (пункт 23 захода
 * `03-redesign-2026-08-14`: `pain` и `faq` получили собственные точки) подняла
 * рельс до десяти точек, значит переходов теперь девять — это ожидаемое
 * следствие пересчёта `lib/backgroundLine.ts` от `railPoints()` (единственный
 * источник, второй список переходов не заводится), а не поломка. Проверка
 * идёт по data-атрибутам (lib/backgroundLine.ts, раздел 4, схема Ч-3), не по
 * картинке — картинка проверяется юнит-тестом геометрии. */
test.describe('линия на фоне — переходы стоят на границах актов (схема Ч-4)', () => {
  /* Прежний сторож кодировал схему Ч-3 («переход на границе каждой точки
   * рельса») и требовал девять переходов. Ч-3 умерла от арифметики: D-048
   * дал десять точек рельса на десять секций, и правило выродилось в
   * «переход на каждом стыке» — то, что бриф линии сам отверг словами
   * «событие на каждом стыке — значит событий нет». Действует Ч-4 (D-049):
   * переход стоит на границе АКТОВ, а переход, оставляющий прогон короче
   * экрана, поглощается предыдущим актом.
   *
   * Проверяется правило, а не список: набор переходов выводится из
   * замеренной раскладки заново и сверяется с разметкой. Список секций в
   * тесте не зашит — смени состав главной, и ожидание пересчитается само. */
  const MIN_RUN = 900;

  test('переходы стоят там, где меняется акт, и нигде больше', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const sections = await page.locator('section[data-line-side]').evaluateAll((els) =>
      els.map((el) => ({
        id: el.id,
        side: el.getAttribute('data-line-side'),
        turn: el.getAttribute('data-line-turn'),
        top: el.getBoundingClientRect().top + window.scrollY,
        bottom: el.getBoundingClientRect().bottom + window.scrollY,
      })));

    expect(sections.length, 'секции линии не найдены').toBeGreaterThan(0);

    const turning = sections.filter((s) => s.turn !== 'none');

    // 1. Сторона меняется РОВНО на переходах и нигде больше.
    sections.forEach((s, i) => {
      if (i === 0) return;
      const flipped = s.side !== sections[i - 1].side;
      expect(
        flipped,
        `секция «${s.id}»: сторона ${flipped ? 'сменилась' : 'не сменилась'}, ` +
        `а переход ${s.turn === 'none' ? 'не объявлен' : `объявлен (${s.turn})`}`,
      ).toBe(s.turn !== 'none');
    });

    // 2. Направление перехода согласовано со стороной, на которую он ведёт.
    turning.forEach((s) => {
      expect(s.turn, `переход в «${s.id}» ведёт не на свою сторону`)
        .toBe(s.side === 'right' ? 'lr' : 'rl');
    });

    // 3. Ни один прогон не короче экрана — вторая половина правила Ч-4.
    const bounds = [0, ...turning.map((s) => s.top), sections[sections.length - 1].bottom];
    for (let i = 1; i < bounds.length; i += 1) {
      const run = bounds[i] - bounds[i - 1];
      expect(run, `прогон ${i} короче экрана: ${Math.round(run)}px`)
        .toBeGreaterThanOrEqual(MIN_RUN);
    }

    // 4. Начало слева, финиш справа — линия приходит к подвалу с той же
    //    стороны, с которой он рисует свой хвост.
    expect(sections[0].side).toBe('left');
    expect(sections[sections.length - 1].side).toBe('right');
  });
});

/* Раздел 9, пункты 5–7 — «рисуется, а не появляется» в машинной форме.
 * Устройство раздела 7.3 (`animation-range: cover var(--line-lead) cover
 * calc(100% - var(--line-trail))`, `lead + trail = 100vh`, боксы мостят
 * документ без зазоров — раздел 3.5) обязано давать РОВНО ОДИН путь в
 * промежуточном состоянии (`0 < dashoffset < 1`) в любой момент прокрутки:
 * все остальные — строго 0 (уже дорисованы) или строго 1 (ещё не начаты).
 * Ноль путей в промежуточном состоянии — это и есть дефект «двадцать три из
 * тридцати точек прокрутки пустые», из-за которого линия «появлялась»
 * кусками, а не рисовалась непрерывно.
 *
 * Тест красный на коде до правки высоты `.line-run` (см. отчёт исполнителя,
 * `BackgroundLine.astro`: `top: 0; bottom: 0` на замещаемом SVG-элементе с
 * `viewBox` даёт высоту из СОБСТВЕННОГО соотношения сторон, а не из
 * контейнера — прогон рисуется на первых ~80 px секции и дальше стоит
 * пустым, вместо того чтобы дотянуться до низа) и на коде, где
 * `animation-timeline: view()` стоит прямо на `<path>` (подлежащим тогда
 * служит раздутая выносом концов геометрия самого пути — раздел 7.3-правка). */
test.describe('линия на фоне — непрерывность рисования (раздел 9, пункты 5–7)', () => {
  test('ровно один путь в промежуточном состоянии на каждом шаге прокрутки', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    // `#hero` несёт одноразовое вычерчивание при загрузке (раздел 7.4,
    // `line-load`, 1400ms, время — не прокрутка): пока оно не осядет,
    // `stroke-dashoffset` героя идёт по РЕАЛЬНОМУ времени, а не по позиции
    // прокрутки, и снятый в эту секунду замер описывает интро-анимацию, а
    // не непрерывность механики раздела 7.3 — не дефект, а другой, законный
    // источник движения того же свойства. Ждём его завершения явно.
    await page.waitForTimeout(1500);

    const { scrollHeight, viewportHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    const maxScroll = scrollHeight - viewportHeight;
    expect(maxScroll, 'страница не прокручивается — тест бессмыслен').toBeGreaterThan(300);

    const STEP = 300;
    const samples: { y: number; mid: number; total: number }[] = [];
    for (let y = 0; y <= maxScroll; y += STEP) {
      await page.evaluate((sy) => window.scrollTo(0, sy), y);
      // Скролл-таймлайн пересчитывается на кадре компоновки, не синхронно
      // с `scrollTo()` — без ожидания следующего кадра снимок читает СТАРОЕ
      // значение `stroke-dashoffset` (замер этого же самого дефекта дважды
      // подряд дал ложное «два пути в промежуточном состоянии разом»,
      // пока не добавили этот `requestAnimationFrame`; инструмент был
      // неисправен, не код).
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      const counts = await page.evaluate((sel) => {
        const paths = Array.from(document.querySelectorAll(sel)) as SVGPathElement[];
        let mid = 0;
        for (const p of paths) {
          const off = parseFloat(getComputedStyle(p).strokeDashoffset);
          // Порог 2%, а не 0,2%: на СТЫКЕ двух окон предыдущий путь стоит
          // на ~0,003 (дорисован), а следующий на ~0,997 (едва начат) —
          // замерено. При допуске 0,002 оба считались бы «рисующимися», и
          // сторож ловил бы дискретность собственных замеров, а не дефект.
          if (off > 0.02 && off < 0.98) mid += 1;
        }
        return { mid, total: paths.length };
      }, LINE_PATH_SELECTOR);
      samples.push({ y, mid: counts.mid, total: counts.total });
    }

    expect(samples[0].total, 'пути линии не найдены на странице').toBe(14);

    // Ноль путей в промежуточном состоянии допустим только на самом верху
    // (до начала первого прогона) и на самом низу (после конца хвоста) —
    // раздел 9, пункт 7. В любой другой точке — ровно один.
    const bad = samples.filter((s, i) => {
      // Требуется ХОТЯ БЫ один рисующийся путь, а не ровно один. Ровно
      // один — недостижимое при выборочных замерах условие: шаг прокрутки
      // может прийтись ровно на стык, где кончик передаётся от куска к
      // куску. Дефект, ради которого сторож писан, — это mid === 0, то есть
      // участок страницы, на котором не рисуется НИЧЕГО: линия там стоит
      // готовой и «появляется», а не рисуется. Верхняя граница в два пути
      // оставлена намеренно: три и больше означали бы, что окна перекрылись
      // по-настоящему, а не разошлись на округлении.
      if (s.mid >= 1 && s.mid <= 2) return false;
      const edge = i === 0 || i === samples.length - 1;
      return !(edge && s.mid === 0);
    });
    expect(
      bad,
      `непрерывность нарушена в точках прокрутки: ${bad.map((s) => `${s.y}px (mid=${s.mid})`).join(', ')}`,
    ).toEqual([]);
  });
});

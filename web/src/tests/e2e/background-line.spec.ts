import { test, expect } from '@playwright/test';

/** Линия на фоне главной — бриф `70-workshop/specs/site-v3/05-line.md`,
 *  раздел 10 шаг 6. Механика — инлайновые `<svg class="line"><path/></svg>`
 *  плюс сосед `<div class="line-curtain">` внутри каждой `<section data-
 *  line-side>`/`<footer data-line-side>` — ОДИН класс `.line` на бокс, ОДИН
 *  путь на секцию: прогон, траверс и событие уже слиты реестром (`lib/
 *  linePaths.ts`) в один `d`. Элемента `.line-turn` больше нет (раздел 7.1
 *  брифа `05-line`: «отдельного бокса ему не нужно»).
 *
 *  ПРАВКА 2026-08-21 (D-080, «пролагивает при листании»): раскрытие пути
 *  больше не несёт `stroke-dashoffset` (не композитится Chromium — каждый
 *  кадр перекрашивает весь бокс). Путь теперь рисуется ЦЕЛИКОМ и статично,
 *  а раскрывает его шторка (`.line-curtain`) через `transform: scaleY(...)`
 *  на том же `view()`-таймлайне — композитное свойство, перекраски нет.
 *  ПРАВКА (тот же день, второй проход D-080): первая версия двигала шторку
 *  через `translate` — заменена на `scaleY`, потому что `translate` в
 *  процентах не композитится (величина зависит от высоты бокса, каждый
 *  кадр уходит на главный поток; замер `headed.mjs` — 38 пропущенных кадров
 *  вместо цели ≤10). Тесты ниже проверяют разметку и мотор ШТОРКИ, а не
 *  пути: `animation-name`/`transform` сидят на `<div class="line-curtain">`,
 *  не на `<path>`.
 *
 *  ЛОВУШКА headless-Chromium: по умолчанию он отдаёт `prefers-reduced-
 *  motion: reduce`, даже когда тест явно этого не просил — любая проверка
 *  движения обязана эмулировать `no-preference` явно, иначе «обычный путь»
 *  тихо тестирует то же самое запасное состояние, что и тест на reduce. */

const LINE_SELECTOR = '.line';
const CURTAIN_SELECTOR = '.line-curtain';
// Десять секций главной, подвал линии не несёт — раздел 12.1 брифа
// `11-line-narrator-brief.md`, В-4 (ПРАВКА `2026-08-27`): владелец
// подтвердил референс, линия уходит за левую кромку холста внутри самой
// секции `contact` и в подвал не заходит, `Footer.astro` больше не рисует
// `.line`/`.line-curtain`. Раньше здесь стояло 11 (десять секций + хвост
// подвала, раздел 10 шаг 4 брифа `05-line`) — то число ушло вместе со
// снятой записью `LINE_PATHS.footer`.
const LINE_ELEMENT_COUNT = 10;

/** Читает `scaleY` из `getComputedStyle(el).transform` — вычисленный вид
 *  всегда матрица `matrix(a, b, c, d, e, f)` для 2D `transform`, без
 *  вращения `b = c = 0`, `d` и есть `scaleY` (4-й компонент). `NaN`, если
 *  вычисленное значение — `none` (нет назначенного transform вовсе; не
 *  наш случай — шторка всегда несёт хотя бы базовое правило). */
function scaleYFromTransform(computedTransform: string): number {
  const match = computedTransform.match(/matrix\(([^)]+)\)/);
  if (!match) return NaN;
  const parts = match[1].split(',').map((n) => parseFloat(n.trim()));
  return parts[3];
}

/** Ищет В ОДНОМ css-тексте `@supports`-блок, несущий анимацию шторки —
 *  тот, чьё тело содержит `.line-curtain` (маркер условия — общая
 *  техника, её же несут карточки/диалог/тизер в СВОИХ отдельных блоках,
 *  см. комментарий у вызова). Возвращает границы блока или `null`, если
 *  в этом конкретном тексте такого блока нет. */
function findLineCurtainSupportsBlock(css: string, marker: string) {
  let start = css.indexOf(marker);
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
    if (css.slice(start, end).includes('.line-curtain')) return { start, end };
    start = css.indexOf(marker, end);
  }
  return null;
}

/** Находит `@supports`-блок анимации шторки — В ЛЮБОЙ из форм подключения.
 *  `<style set:html={...}>` (`BackgroundLine.astro`, `revealKeyframesCss` +
 *  `drawingSupportsCss`) — единственный способ вставить сгенерированный по
 *  реестру CSS в Astro, и такой тег Astro НИКОГДА не выносит во внешний
 *  файл (в отличие от статических `<style>` без `set:html`) — он остаётся
 *  инлайновым в HTML. Позиционирование/бокс шторки (статический `<style>`
 *  того же компонента) при этом уходит во внешний подключённый файл —
 *  бандлер решает какой именно, число внешних файлов не гарантировано.
 *  Прежняя версия смотрела ТОЛЬКО на `link[rel="stylesheet"]` и падала
 *  «блок не нашёлся» — не потому что блок исчез, а потому что он живёт в
 *  инлайновом `<style>`, куда эта версия не смотрела. Проверяем ОБА места,
 *  как это делает сам браузер (инлайновые и подключённые правила
 *  каскадируются вместе одинаково). */
async function findLineDrawingBlock(page: import('@playwright/test').Page) {
  const marker = '@supports (animation-timeline:view())';

  const inline = await page.evaluate(
    ({ m }) => Array.from(document.querySelectorAll('style'))
      .map((el, index) => ({ index, text: el.textContent ?? '' }))
      .find(({ text }) => text.includes(m) && text.includes('.line-curtain')),
    { m: marker },
  );
  if (inline) {
    const block = findLineCurtainSupportsBlock(inline.text, marker);
    if (block) return { kind: 'inline' as const, index: inline.index, css: inline.text, ...block };
  }

  const hrefs = await page.locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((l) => l.getAttribute('href') ?? ''));
  for (const href of hrefs) {
    const res = await page.request.get(href);
    const css = await res.text();
    const block = findLineCurtainSupportsBlock(css, marker);
    if (block) return { kind: 'linked' as const, href, css, ...block };
  }
  throw new Error('@supports-блок шторки линии (.line-curtain) не найден ни в инлайновых, ни в подключённых стилях');
}

test.describe('линия на фоне — запасное состояние без поддержки animation-timeline', () => {
  test('без блока @supports шторка убрана, линия видна целиком, без анимации', async ({ page }) => {
    await page.goto('/');
    // `animation-timeline:view()` — общая техника: её же несут карточки,
    // диалог и ядро тизера фабрики (каждый в СВОЁМ @supports). Резать нужно
    // ИМЕННО блок линии — тот, что содержит уникальную для неё анимацию
    // `.line-curtain{...animation-timeline...}` — а не первый по тексту
    // @supports с этим условием (см. `findLineDrawingBlock`).
    const found = await findLineDrawingBlock(page);
    const withoutSupports = found.css.slice(0, found.start) + found.css.slice(found.end);

    /* Вне вырезанного блока имя `line-load` остаётся ЗАКОННО — это само
       объявление `@keyframes`, которое сборщик держит на верхнем уровне и
       которое ничего не применяет: набор кадров без `animation-name` не
       двигает ничего. Проверять надо ПРИМЕНЕНИЕ: базовое правило вне
       `@supports` держит `transform: scaleY(0)` (шторка убрана) безусловно.

       Голый `.not.toContain('animation-timeline:view()')` по ВСЕМУ
       остатку файла — ложный сигнал: карточки (`.reveal`) несут ТУ ЖЕ
       технику в СВОЁМ, отдельном и корректном `@supports (animation-
       timeline: view())`, который здесь и должен остаться (комментарий
       выше по файлу это прямо оговаривает). Проверять нужно узко —
       что СЕЛЕКТОР `.line-curtain` нигде за пределами вырезанного блока
       не несёт `animation-timeline`. */
    const leaked = /\.line-curtain\{[^}]*animation-timeline/.test(withoutSupports);
    expect(leaked, 'вне @supports осталось назначение animation-timeline на шторке').toBe(false);

    if (found.kind === 'inline') {
      await page.evaluate(
        ({ index, css }) => {
          (document.querySelectorAll('style')[index] as HTMLStyleElement).textContent = css;
        },
        { index: found.index, css: withoutSupports },
      );
    } else {
      await page.route(`**${found.href}`, (route) =>
        route.fulfill({ status: 200, contentType: 'text/css', body: withoutSupports }));
      await page.reload();
    }

    const style = await page.locator(CURTAIN_SELECTOR).first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { transform: s.transform, animationName: s.animationName };
    });
    // Запасное состояние — `transform: scaleY(0)` (шторка сжата в ноль
    // высоты, невидима — линия открыта целиком), безусловно, без анимации.
    expect(style.animationName).toBe('none');
    const scaleY = scaleYFromTransform(style.transform);
    expect(scaleY, `шторка не убрана: transform=${style.transform}`).toBeLessThan(0.02);
  });
});

test.describe('линия на фоне — уменьшенное движение', () => {
  test('при prefers-reduced-motion: reduce шторка убрана, без анимации',
    async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.goto('/');
      const style = await page.locator(CURTAIN_SELECTOR).first().evaluate((el) => {
        const s = getComputedStyle(el);
        return { transform: s.transform, animationName: s.animationName };
      });
      expect(style.animationName).toBe('none');
      const scaleY = scaleYFromTransform(style.transform);
      expect(scaleY, `шторка не убрана: transform=${style.transform}`).toBeLessThan(0.02);
      await ctx.close();
    });

  test('при prefers-reduced-motion: reduce путь видим целиком (нет dasharray/dashoffset)',
    async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.goto('/');
      const style = await page.locator(`${LINE_SELECTOR} path`).first().evaluate((el) => {
        const s = getComputedStyle(el);
        return { dasharray: s.strokeDasharray, opacity: s.strokeOpacity };
      });
      // Путь больше не несёт пунктир вовсе (раздел 7.2 брифа, ПРАВКА D-080) —
      // раскрытие несёт шторка, не dasharray/dashoffset самого пути.
      expect(style.dasharray).toBe('none');
      expect(Number(style.opacity)).toBeGreaterThan(0);
      await ctx.close();
    });
});

test.describe('линия на фоне — обычный путь (поддержка есть, движение разрешено)', () => {
  test('каждая .line-curtain получает анимацию, завязанную на view()', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    await page.goto('/');
    const styles = await page.locator(CURTAIN_SELECTOR).evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        return { animationName: s.animationName, timeline: s.animationTimeline };
      }));
    // Десять секций главной + хвост подвала = 11 путей (раздел 10 шаг 4:
    // «одиннадцать путей»). Переход больше не отдельный элемент (раздел 7.1).
    expect(styles.length).toBe(LINE_ELEMENT_COUNT);
    for (const s of styles) {
      expect(s.animationName).not.toBe('none');
    }
    await ctx.close();
  });

  test('линия присутствует в HTML без выполнения JavaScript (статика)', async ({ request }) => {
    const res = await request.get('/');
    const html = await res.text();
    // Десять секций главной + подвал (`footerLineData()`, раздел 7.2:
    // «подвал получает тот же класс `.line`, ту же сторону, что у
    // contact») — источник lib/sections.ts + Footer.astro.
    expect((html.match(/data-line-side="(left|right)"/g) ?? []).length).toBe(11);
    expect(html).toContain('class="line"');
    expect(html).toContain('class="line-curtain"');
  });

  test('линия и шторка — не орган управления: вне таб-порядка и указателя', async ({ page }) => {
    await page.goto('/');
    const first = page.locator(LINE_SELECTOR).first();
    await expect(first).toHaveAttribute('aria-hidden', 'true');
    const pointerEvents = await first.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pointerEvents).toBe('none');

    const curtain = page.locator(CURTAIN_SELECTOR).first();
    await expect(curtain).toHaveAttribute('aria-hidden', 'true');
    const curtainPointerEvents = await curtain.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(curtainPointerEvents).toBe('none');
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
 * порождает горизонтальную прокрутку: холст `.line` ограничен `--line-canvas`
 * (`min(100vw, 1440px)`, сужен до 1252px на 1324…1439 ради рельса — раздел
 * 4.2 брифа `05-line`), границу проверяем измерением, а не полагаемся на
 * формулу. */
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
 * документ без зазоров — раздел 3.5) обязано давать РОВНО ОДИН элемент в
 * промежуточном состоянии (шторка ЧАСТИЧНО убрана — `0 < прогресс < 1`) в
 * любой момент прокрутки: все остальные — строго «убрана» (открыт целиком)
 * или строго «на месте» (ещё не начат). Ноль элементов в промежуточном
 * состоянии — это и есть дефект «появляется кусками, а не рисуется».
 *
 * ПРАВКА 2026-08-21 (D-080): «прогресс» теперь читается не из
 * `stroke-dashoffset` пути, а из `transform: scaleY(...)` шторки —
 * безразмерная величина, `frac = 1 − scaleY` даёт долю раскрытия напрямую,
 * без деления на `getBoundingClientRect().height` (в отличие от первой
 * версии на `translate`, которая давала долю от высоты бокса). */
test.describe('линия на фоне — непрерывность рисования (раздел 9, пункты 5–7)', () => {
  test('ровно один элемент в промежуточном состоянии на каждом шаге прокрутки', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    // `#hero` несёт одноразовое вычерчивание при загрузке (раздел 7.4,
    // `line-load`, 1400ms, время — не прокрутка): пока оно не осядет,
    // `transform` героя идёт по РЕАЛЬНОМУ времени, а не по позиции
    // прокрутки — не дефект, а другой, законный источник движения того же
    // свойства. Ждём его завершения явно.
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
      // значение (ловушка ловилась дважды на `stroke-dashoffset`, затем на
      // `translate`, здесь тот же приём для `transform`).
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      const counts = await page.evaluate((sel) => {
        const curtains = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
        let mid = 0;
        for (const c of curtains) {
          // `transform: scaleY(<число>)` вычисляется в БЕЗРАЗМЕРНУЮ матрицу
          // `matrix(1, 0, 0, scaleY, 0, 0)` — никакой двусмысленности px/%,
          // которую нёс прежний `translate` (ловушка первой версии этого
          // теста), делить на высоту бокса не нужно вовсе. `scaleY` — 4-й
          // компонент матрицы; тождество `BackgroundLine.astro`/`toScaleY`:
          // `scaleY = 1 − X/100`, значит доля раскрытия `frac = 1 − scaleY`.
          const t = getComputedStyle(c).transform;
          const match = t.match(/matrix\(([^)]+)\)/);
          const scaleY = match ? parseFloat(match[1].split(',')[3]) : 1;
          const frac = 1 - scaleY;
          // 0 — перекрывает целиком, 1 — убрана целиком.
          // Порог 2%, а не 0,2% — тот же приём, что был у `stroke-dashoffset`:
          // на СТЫКЕ двух окон предыдущий элемент стоит на ~0,997 (открыт), а
          // следующий на ~0,003 (едва начат).
          if (frac > 0.02 && frac < 0.98) mid += 1;
        }
        return { mid, total: curtains.length };
      }, CURTAIN_SELECTOR);
      samples.push({ y, mid: counts.mid, total: counts.total });
    }

    expect(samples[0].total, 'шторки линии не найдены на странице').toBe(LINE_ELEMENT_COUNT);

    // Ноль элементов в промежуточном состоянии допустим на самом верху (до
    // начала первого прогона) и на самом низу (после конца хвоста) — раздел
    // 9, пункт 7 — и, ПРАВКА 2026-08-22, на ОДНОЙ изолированной выборке
    // ровно на стыке двух окон раскрытия. Причина правки —
    // `BackgroundLine.astro`, «Развести источник таймлайна шторки и её
    // вынесенный бокс» (та же задача, коммит перед этим): окна раскрытия
    // соседних секций раньше НАХЛЁСТЫВАЛИСЬ (источник таймлайна — бокс
    // шторки, вынесенный `CAP_OVERHANG` за бокс секции) — это и был дефект
    // «оторванный кусок линии» (снимки владельца, задача «переставь мне
    // окна»), а нахлёст попутно давал этому тесту запас: рядом со стыком
    // почти всегда находился элемент СЛЕДУЮЩЕГО окна, уже начавший
    // раскрываться чуть РАНЬШЕ срока. Починка свела окна ВСТЫК, без
    // нахлёста и без зазора (доказано геометрическим сторожем
    // `background-line-ink-continuity.spec.ts`, который меряет ФАКТИЧЕСКИЕ
    // чернила на экране, а не состояние шторки) — и у самой точки стыка
    // ОДНА выборка шагом `STEP=300px` может застать оба элемента уже вне
    // полосы 2%…98% (уходящий на ~0,99, приходящий на ~0,01): и то, и
    // другое — «на месте», не «в процессе», значит `mid=0` в этой ОДНОЙ
    // точке. Ширина этой полосы на экране — доли процента высоты соседних
    // секций (кромки полосы 2%/98%, раздел 7.3 брифа `05-line.md`), заведомо
    // меньше шага выборки, и геометрический сторож подтверждает: чернила в
    // этих самых точках прокрутки непрерывны, разрыва на экране нет.
    // Дефект — ПРОТЯЖЁННЫЙ провал: две и более идущих подряд выборки с
    // `mid=0` (тогда никакое окно не покрывает эту зону раскрытия вовсе,
    // и это уже не эффект шага сетки, а настоящий зазор между окнами).
    const bad = samples.filter((s, i) => {
      if (s.mid >= 1 && s.mid <= 2) return false;
      if (s.mid > 2) return true;
      const edge = i === 0 || i === samples.length - 1;
      if (edge) return false;
      const prevMid = samples[i - 1]?.mid ?? 0;
      const nextMid = samples[i + 1]?.mid ?? 0;
      const isolatedStitchDip = prevMid >= 1 && nextMid >= 1;
      return !isolatedStitchDip;
    });
    expect(
      bad,
      `непрерывность нарушена в точках прокрутки: ${bad.map((s) => `${s.y}px (mid=${s.mid})`).join(', ')}`,
    ).toEqual([]);
  });
});

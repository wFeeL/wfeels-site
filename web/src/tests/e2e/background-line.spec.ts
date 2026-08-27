import { test, expect } from '@playwright/test';

/** Линия на фоне главной — бриф `70-workshop/specs/site-v3/05-line.md`,
 *  раздел 10 шаг 6, поверх `70-workshop/specs/site-v3/
 *  15-line-through-scale-brief.md` (раздел 2 — механика раскрытия).
 *
 *  ПРАВКА `2026-08-27` (сквозная шкала): одиннадцать поштучных
 *  `.line-curtain` (по одной на секцию + подвал) заменены ОДНОЙ шторкой на
 *  всю страницу (`position: fixed`, `top: var(--line-head)`). У рисования
 *  не остаётся ни одной прокруточной анимации — шторка не едет по
 *  `view()`-таймлайну секции, она стоит на постоянной экранной линии, а
 *  движется вместе с документом просто потому, что `scrollY` растёт.
 *  Единственная анимация самой шторки — `line-load`, временная (1400мс),
 *  не прокруточная, играет один раз при загрузке.
 *
 *  Тесты этого файла, проверявшие МЕХАНИЗМ раскрытия по секциям (`scaleY`
 *  на каждой из одиннадцати шторок, «ровно один элемент в промежуточном
 *  состоянии») — сняты вместе с предметом: посекционных окон раскрытия
 *  больше нет, считать нечего. Их работу — протяжённость и непрерывность
 *  краски — делает `background-line-ink-continuity.spec.ts` (П-Э1…П-Э4,
 *  раздел 7 брифа `15-…`).
 *
 *  ЛОВУШКА headless-Chromium: по умолчанию он отдаёт `prefers-reduced-
 *  motion: reduce`, даже когда тест явно этого не просил — любая проверка
 *  движения обязана эмулировать `no-preference` явно. */

const LINE_SELECTOR = '.line';
const CURTAIN_SELECTOR = '.line-curtain';
// Десять секций главной несут путь (`svg.line`) — не тронуто этой правкой.
const LINE_ELEMENT_COUNT = 10;

/** Ищет В ОДНОМ css-тексте `@supports`-блок, несущий анимацию шторки —
 *  тот, чьё тело содержит `.line-curtain` (маркер условия — общая техника,
 *  её же несут карточки/диалог/тизер в СВОИХ отдельных блоках). */
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

/** Находит `@supports`-блок анимации шторки — в инлайновом `<style>` или в
 *  подключённом файле (бандлер решает, куда попадёт литеральный `<style
 *  is:global>` — число внешних файлов не гарантировано; браузер каскадирует
 *  оба места одинаково). */
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
  test('без блока @supports шторка убрана (display:none), линия видна целиком, без анимации', async ({ page }) => {
    await page.goto('/');
    const found = await findLineDrawingBlock(page);
    const withoutSupports = found.css.slice(0, found.start) + found.css.slice(found.end);

    // Вне вырезанного блока `.line-curtain` не должна нести ни `display:
    // block`, ни `animation-timeline` — оба назначаются ТОЛЬКО внутри
    // @supports/@media (раздел 2.2 брифа `15-…`).
    const leakedTimeline = /\.line-curtain\{[^}]*animation-timeline/.test(withoutSupports);
    expect(leakedTimeline, 'вне @supports осталось назначение animation-timeline на шторке').toBe(false);

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
      return { display: s.display, animationName: s.animationName };
    });
    expect(style.animationName).toBe('none');
    expect(style.display, 'шторка не убрана вне @supports — базовое правило обязано быть display:none').toBe('none');
  });
});

test.describe('линия на фоне — уменьшенное движение', () => {
  test('при prefers-reduced-motion: reduce шторка убрана (display:none), без анимации',
    async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.goto('/');
      const style = await page.locator(CURTAIN_SELECTOR).first().evaluate((el) => {
        const s = getComputedStyle(el);
        return { display: s.display, animationName: s.animationName };
      });
      expect(style.animationName).toBe('none');
      expect(style.display).toBe('none');
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
      expect(style.dasharray).toBe('none');
      expect(Number(style.opacity)).toBeGreaterThan(0);
      await ctx.close();
    });
});

test.describe('линия на фоне — обычный путь (поддержка есть, движение разрешено)', () => {
  test('ровно одна .line-curtain на странице — сквозная шкала, не посекционные окна', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    await page.goto('/');
    const count = await page.locator(CURTAIN_SELECTOR).count();
    expect(count, 'раздел 2.2 брифа 15-…: одна шторка на весь документ, не одиннадцать').toBe(1);
    await ctx.close();
  });

  test('шторка фиксирована к окну (position:fixed), стоит на --line-head, а не на scaleY-прогрессе секции', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    await page.goto('/');
    const style = await page.locator(CURTAIN_SELECTOR).evaluate((el) => {
      const s = getComputedStyle(el);
      return { position: s.position, animationName: s.animationName, top: s.top };
    });
    expect(style.position).toBe('fixed');
    expect(style.animationName).toBe('line-load');
    expect(style.top, 'top шторки обязан быть числом px (var(--line-head) вычислен), не auto/0').not.toBe('auto');
    await ctx.close();
  });

  test('линия присутствует в HTML без выполнения JavaScript (статика)', async ({ request }) => {
    const res = await request.get('/');
    const html = await res.text();
    // Десять секций главной + подвал (`footerLineData()`) несут метаданные
    // data-line-side — не тронуто этой правкой (геометрия путей та же).
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

    const curtain = page.locator(CURTAIN_SELECTOR);
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

/* Раздел 6 брифа `05-line` отменяет D-026: порог 900 px (линия не рисуется
 * вовсе) заменён на 480 px. */
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

  test('на 480…899 px сквозная шторка тоже видна (display:block) — раздел 6.4 брифа 15-…: механика ширины не знает', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 600, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('/');
    const display = await page.locator(CURTAIN_SELECTOR).evaluate((el) => getComputedStyle(el).display);
    expect(display).toBe('block');
    await ctx.close();
  });
});

/* Раздел 9, пункт 7 — ни на одной ширине из числа проверяемых линия не
 * порождает горизонтальную прокрутку. */
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
 * и они стоят на границах точек рельса. Метаданные Ч-4 (`data-line-side`/
 * `data-line-turn`) не тронуты этой правкой — механика раскрытия и разметка
 * стороны/перехода независимы друг от друга. */
test.describe('линия на фоне — переходы стоят на границах актов (схема Ч-4)', () => {
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

    sections.forEach((s, i) => {
      if (i === 0) return;
      const flipped = s.side !== sections[i - 1].side;
      expect(
        flipped,
        `секция «${s.id}»: сторона ${flipped ? 'сменилась' : 'не сменилась'}, ` +
        `а переход ${s.turn === 'none' ? 'не объявлен' : `объявлен (${s.turn})`}`,
      ).toBe(s.turn !== 'none');
    });

    turning.forEach((s) => {
      expect(s.turn, `переход в «${s.id}» ведёт не на свою сторону`)
        .toBe(s.side === 'right' ? 'lr' : 'rl');
    });

    const bounds = [0, ...turning.map((s) => s.top), sections[sections.length - 1].bottom];
    for (let i = 1; i < bounds.length; i += 1) {
      const run = bounds[i] - bounds[i - 1];
      expect(run, `прогон ${i} короче экрана: ${Math.round(run)}px`)
        .toBeGreaterThanOrEqual(MIN_RUN);
    }

    expect(sections[0].side).toBe('left');
    expect(sections[sections.length - 1].side).toBe('right');
  });
});

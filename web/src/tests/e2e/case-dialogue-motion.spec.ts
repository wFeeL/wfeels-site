import { test, expect, type Page } from '@playwright/test';

/* Окно переписки кейса «ИИ-консультант» — раскрой, кегль, запасное состояние
 * и затвор цикла. Устройство задано эскизом и решениями владельца 2026-08-19
 * (ровно одна пара реплик, пузырёк «печатает», строка ввода с кнопкой, цикл
 * 8 с); проверяется здесь ФАКТ на живой сборке, а не намерение автора.
 *
 * Зачем этот файл вообще заведён: дефект «рисунок не помещается в поле»
 * месяц жил в соседней иллюстрации и не был пойман ни одним тестом — там
 * срезалось 194 px, сорок процентов схемы, и увидел это только человек.
 * Здесь тот же класс дефекта ловится замером на четырёх ширинах.
 *
 * Три ловушки, на которых замер спотыкался в соседнем наборе; не
 * переоткрывать заново:
 *
 * 1. Безголовый Chromium по умолчанию просит `prefers-reduced-motion:
 *    reduce` — то есть ЗАПАСНОЕ состояние и есть то, что видят тесты. Проверяя
 *    движение, контекст явно создаётся с `reducedMotion: 'no-preference'`.
 * 2. Кадры цикла перебираются ОДНИМ `page.evaluate()`, а не десятком рейсов.
 * 3. Остановка вне окна проверяется приростом `getAnimations()[0].currentTime`,
 *    а не тем, что в CSS написано `animation-play-state: paused`.
 */

const CHAT = '#cases [data-case-dialogue]';
const PERIOD_MS = 8000;

/** Ширины приёмки. 390 — телефон, 900 — граница мобильной раскладки строки
 *  кейса, 1180 — ширина контейнера, 1440 — типовой десктоп. */
const WIDTHS = [390, 900, 1180, 1440] as const;

/** Минимальный кегль текста В РИСУНКЕ (`02-case-illustrations.md`, 2.3).
 *  Метка-заголовок поля (11 px), на которую это правило не действовало,
 *  снята владельцем — исключений в окне переписки не осталось. */
const MIN_FONT_PX = 14;

async function measure(page: Page) {
  return page.evaluate((sel) => {
    const chat = document.querySelector(sel) as HTMLElement | null;
    if (!chat) throw new Error(`нет ${sel}`);
    const field = chat.closest('.field') as HTMLElement;
    if (!field) throw new Error('окно переписки лежит вне поля иллюстрации');
    const fs = getComputedStyle(field);
    const fr = field.getBoundingClientRect();
    const inner = {
      w: fr.width - parseFloat(fs.paddingLeft) - parseFloat(fs.paddingRight)
        - parseFloat(fs.borderLeftWidth) - parseFloat(fs.borderRightWidth),
      h: fr.height - parseFloat(fs.paddingTop) - parseFloat(fs.paddingBottom)
        - parseFloat(fs.borderTopWidth) - parseFloat(fs.borderBottomWidth),
    };
    const cr = chat.getBoundingClientRect();

    /* Кегль снимается с КАЖДОГО узла, несущего текст, а не с списка
       заранее известных классов: новый элемент с мелким кеглем обязан
       провалить этот тест, а не проехать мимо перечисления. */
    const walker = document.createTreeWalker(chat, NodeFilter.SHOW_TEXT);
    let minPx = Infinity;
    let minWho = '';
    let nodes = 0;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node.textContent || '').trim();
      if (!text) continue;
      const el = node.parentElement!;
      if (getComputedStyle(el).display === 'none') continue;
      nodes += 1;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px < minPx) {
        minPx = px;
        minWho = `«${text.slice(0, 28)}»`;
      }
    }
    return {
      inner,
      chat: { w: cr.width, h: cr.height },
      overflowY: field.scrollHeight - field.clientHeight,
      overflowX: field.scrollWidth - field.clientWidth,
      minPx,
      minWho,
      nodes,
    };
  }, CHAT);
}

test.describe('«ИИ-консультант» — раскрой в поле и кегль', () => {
  for (const width of WIDTHS) {
    test(`${width} px: окно переписки целиком в поле, текст не мельче ${MIN_FONT_PX} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.locator(CHAT).scrollIntoViewIfNeeded();
      const m = await measure(page);

      expect(m.nodes, 'в окне переписки не нашлось текста').toBeGreaterThanOrEqual(6);
      expect(
        m.chat.w,
        `окно шире поля: ${m.chat.w.toFixed(1)} против ${m.inner.w.toFixed(1)}`,
      ).toBeLessThanOrEqual(m.inner.w + 0.5);
      expect(
        m.chat.h,
        `окно выше поля: ${m.chat.h.toFixed(1)} против ${m.inner.h.toFixed(1)}`,
      ).toBeLessThanOrEqual(m.inner.h + 0.5);
      expect(m.overflowY, `поле прокручивается по вертикали на ${m.overflowY} px`).toBeLessThanOrEqual(0);
      expect(m.overflowX, `поле прокручивается по горизонтали на ${m.overflowX} px`).toBeLessThanOrEqual(0);
      expect(m.minPx, `самый мелкий текст — ${m.minPx} px, это ${m.minWho}`).toBeGreaterThanOrEqual(MIN_FONT_PX);
    });
  }
});

test.describe('«ИИ-консультант» — запасное состояние', () => {
  for (const width of [1440, 390]) {
    test(`${width} px, reduce: переписка полна и неподвижна`, async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      await page.goto('/');
      await page.locator(CHAT).scrollIntoViewIfNeeded();

      const state = await page.evaluate((sel) => {
        const chat = document.querySelector(sel) as HTMLElement;
        const opacity = (s: string) => Number(getComputedStyle(chat.querySelector(s) as Element).opacity);
        let animations = 0;
        for (const el of chat.querySelectorAll('*')) animations += el.getAnimations().length;
        const typing = chat.querySelector('.typing') as HTMLElement;
        return {
          animations,
          typingDisplay: getComputedStyle(typing).display,
          q: opacity('.q'),
          qMeta: opacity('.q-meta'),
          a: opacity('.a'),
          src: opacity('.src'),
          aMeta: opacity('.a-meta'),
          input: opacity('.input'),
        };
      }, CHAT);

      expect(state.animations, 'при reduce в окне не должно быть ни одной анимации').toBe(0);
      expect(state.typingDisplay, 'пузырёк «печатает» существует только внутри цикла').toBe('none');
      for (const [name, value] of Object.entries(state)) {
        if (typeof value !== 'number' || name === 'animations') continue;
        expect(value, `${name} при reduce прозрачен — запасное состояние обязано быть КОНЕЧНЫМ`).toBe(1);
      }
      expect(errors, `консоль не пуста:\n${errors.join('\n')}`).toEqual([]);
      await context.close();
    });
  }
});

test.describe('«ИИ-консультант» — раскадровка цикла', () => {
  test('вопрос, «печатает», ответ и чип источника приходят по очереди', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto('/');
    await page.locator(CHAT).scrollIntoViewIfNeeded();

    const frames = await page.evaluate(
      async ({ sel, period }) => {
        const chat = document.querySelector(sel) as HTMLElement;
        const anims = [...chat.querySelectorAll('*')].flatMap((el) => el.getAnimations());
        if (anims.length === 0) throw new Error('в окне нет ни одной анимации — цикл не собрался');
        anims.forEach((a) => a.pause());
        const pick = (s: string) => chat.querySelector(s) as HTMLElement;
        const out: Record<string, number>[] = [];
        const FRAMES = 100;
        for (let i = 0; i < FRAMES; i++) {
          const t = (i / FRAMES) * period;
          anims.forEach((a) => { a.currentTime = t; });
          out.push({
            pct: (i / FRAMES) * 100,
            q: Number(getComputedStyle(pick('.q')).opacity),
            typing: Number(getComputedStyle(pick('.typing')).opacity),
            a: Number(getComputedStyle(pick('.a')).opacity),
            src: Number(getComputedStyle(pick('.src')).opacity),
          });
        }
        anims.forEach((a) => a.play());
        return out;
      },
      { sel: CHAT, period: PERIOD_MS },
    );

    const first = (key: string) => frames.find((f) => f[key] > 0.9)?.pct ?? -1;
    const qAt = first('q');
    const typingAt = first('typing');
    const aAt = first('a');
    const srcAt = first('src');

    expect(qAt, 'вопрос посетителя не появляется ни на одном кадре').toBeGreaterThan(0);
    expect(typingAt, '«печатает» не появляется ни на одном кадре').toBeGreaterThan(qAt);
    expect(aAt, 'ответ приходит не позже «печатает»').toBeGreaterThan(typingAt);
    expect(srcAt, 'чип источника приходит не позже ответа').toBeGreaterThanOrEqual(aAt);

    // Точки и ответ не стоят в кадре одновременно: ответ приходит НА МЕСТО точек.
    const both = frames.filter((f) => f.typing > 0.5 && f.a > 0.5).map((f) => `${f.pct}%`);
    expect(both, `«печатает» и ответ видны разом на кадрах: ${both.join(', ')}`).toEqual([]);

    // Есть фаза покоя, где видно всё сразу, и она не короче секунды.
    const rest = frames.filter((f) => f.q > 0.9 && f.a > 0.9 && f.src > 0.9);
    expect(rest.length, 'в цикле нет кадра, где видна вся переписка').toBeGreaterThan(0);
    expect(
      (rest.length / frames.length) * (PERIOD_MS / 1000),
      'покой короче секунды — чип источника не успевают прочитать',
    ).toBeGreaterThan(1);

    // Цикл замкнут: на нулевом кадре окно пусто, и оно же — конец периода.
    expect(frames[0].q, 'цикл начинается не с пустой ленты — на стыке будет рывок').toBeLessThan(0.05);

    await context.close();
  });
});

test.describe('«ИИ-консультант» — затвор цикла', () => {
  test('вне окна цикл стоит, в окне идёт', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto('/');

    const readTime = () =>
      page.evaluate((sel) => {
        const q = document.querySelector(`${sel} .q`) as HTMLElement;
        const t = q.getAnimations()[0]?.currentTime;
        return typeof t === 'number' ? t : Number(t ?? 0);
      }, CHAT);

    // Иллюстрация далеко внизу страницы — при загрузке она вне окна.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const off1 = await readTime();
    await page.waitForTimeout(1000);
    const off2 = await readTime();
    expect(
      off2 - off1,
      `вне окна цикл прирос на ${(off2 - off1).toFixed(0)} мс — затвор не сработал`,
    ).toBeLessThan(50);

    await page.locator(CHAT).scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const on1 = await readTime();
    await page.waitForTimeout(1000);
    const on2 = await readTime();
    expect(
      on2 - on1,
      `в окне цикл прирос всего на ${(on2 - on1).toFixed(0)} мс — движения нет`,
    ).toBeGreaterThan(800);

    await context.close();
  });
});

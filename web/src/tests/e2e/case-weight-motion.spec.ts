import { test, expect, type Page } from '@playwright/test';
import { WEIGHT_ILLUSTRATION } from '../../data/case-illustrations';

/* Движение иллюстрации «Замер» (секция кейсов, блок «Этот сайт»), композиция
 * владельца 2026-08-19: стрелка по центру прорисовывается по мере прокрутки
 * (`animation-timeline`, именованный таймлайн `--weight-view`), четыре числа
 * отсчитываются от нуля до своих значений (инлайновый счётчик компонента).
 *
 * Запасное состояние — состояние ПО УМОЛЧАНИЮ: стрелка нарисована целиком,
 * вывод виден, все четыре числа стоят в конечных значениях.
 *
 * Оба режима эмулируются ЯВНО, своим контекстом, и ни один не оставлен на
 * умолчание. Расхожее «headless Chromium сам просит reduce» на этой версии
 * Playwright неверно — проверено этим заходом: контекст без `reducedMotion`
 * отдаёт `no-preference`, и тест, положившийся на умолчание, читал со
 * страницы «0,0 с» (кадр счётчика) вместо напечатанного числа. Умолчание
 * здесь — не экономия строки, а способ проверить не то. */

const WIDE = { width: 1440, height: 1000 };
const ILLO = '[data-illustration="case-weight"]';
const CELLS = WEIGHT_ILLUSTRATION.cells;

/** Отношение нарисованной длины ствола к его раскладочной высоте: 0 — не
 *  начат, 1 — дорисован. Считается через `transform`, поэтому виден именно
 *  прогресс анимации, а не наличие элемента. */
async function shaftProgress(page: Page, seg: number): Promise<number> {
  return page.locator(`${ILLO} .arrow[data-seg="${seg}"] .shaft`).evaluate((el) => {
    const box = el.getBoundingClientRect();
    return (el as HTMLElement).offsetHeight === 0 ? 0 : box.height / (el as HTMLElement).offsetHeight;
  });
}

/** Тексты всех четырёх чисел в порядке разметки. */
async function printedValues(page: Page): Promise<string[]> {
  return Promise.all(
    CELLS.map((c) => page.locator(`${ILLO} [data-cell="${c.key}"] [data-count]`).innerText()),
  );
}

test.describe('иллюстрация «Замер» — стрелка и счёт по прокрутке', () => {
  test('prefers-reduced-motion: reduce — стрелка целая, все четыре числа в конечных значениях', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: WIDE });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto('/');

    await page.locator(ILLO).scrollIntoViewIfNeeded();

    for (const seg of [1, 2]) {
      expect(await shaftProgress(page, seg), `ствол стрелки ${seg} не дорисован при reduce`)
        .toBeCloseTo(1, 2);
      const head = await page.locator(`${ILLO} .arrow[data-seg="${seg}"] .head`).evaluate(
        (el) => el.getBoundingClientRect().width,
      );
      expect(head, `наконечник стрелки ${seg} не нарисован при reduce`).toBeGreaterThan(0);
    }

    // Вывод проявляется последним при разрешённом движении — и обязан стоять
    // готовым при `reduce`: невидимый вывод и есть рисунок без вывода.
    expect(
      await page.locator(`${ILLO} [data-cell="verdict"]`).evaluate((el) => getComputedStyle(el).opacity),
      'вывод рисунка не виден при reduce',
    ).toBe('1');

    // Отсчёт от нуля не имеет права оставить нули: при `reduce` счётчик вообще
    // не запускается, и на рисунке стоит ровно то, что уехало в сборку.
    expect((await printedValues(page)).map((s) => s.trim())).toEqual(CELLS.map((c) => c.value));

    expect(errors, `консоль не пуста:\n${errors.join('\n')}`).toEqual([]);
    await context.close();
  });

  test('no-preference — стрелка действительно рисуется, числа действительно считаются', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: WIDE });
    const page = await context.newPage();
    await page.goto('/');

    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    let sawShaftMidFlight = false;
    let sawCountMidFlight = false;

    for (let y = 0; y <= height && !(sawShaftMidFlight && sawCountMidFlight); y += 60) {
      /* Прыжок прокрутки и ДВА кадра ожидания, а не замер сразу. Значение
         таймлайна прокрутки коммитит композитор, и сразу после `scrollTo`
         основной поток ещё может отдать величину от ПРЕДЫДУЩЕГО положения.
         Пока по странице не работало ничего постороннего, замер успевал
         почти всегда; с плавной прокруткой (Lenis, `layouts/Base.astro`)
         каждое событие прокрутки добавляет работы основному потоку, и гонка
         стала видимой — прогон 2026-08-20 дал одно падение на шесть, при
         нуле падений на шести прогонах без Lenis. Проверялась ГОНКА ЗАМЕРА,
         а не анимация: тот же прогресс, снятый через Web Animations API
         (`smooth-scroll.spec.ts`), совпадает с обычной прокруткой до нуля.
         Ожидание кадров ничего не ослабляет — требование «поймать полёт»
         осталось прежним, замер стал честным. */
      await page.evaluate((top) => {
        window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
        return new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r())),
        );
      }, y);
      const p = await shaftProgress(page, 1).catch(() => null);
      if (p !== null && p > 0.02 && p < 0.95) sawShaftMidFlight = true;
      const values = await printedValues(page).catch(() => null);
      if (values && values.some((v, i) => v.trim() !== CELLS[i].value)) sawCountMidFlight = true;
    }

    expect(sawShaftMidFlight, 'ствол стрелки ни разу не был замечен в полёте — значит анимация ' +
      'не применяется, а запасной тест проходит вхолостую').toBe(true);
    expect(sawCountMidFlight, 'ни одно число ни разу не отличалось от конечного — счётчик не ' +
      'работает (проверь, что скрипт инлайновый: поднимаемый сюда не доезжает)').toBe(true);

    /* Дожимаем прокруткой малыми шагами, пока стрелка не сойдётся. Диапазон
       движения (`cover 26%…55%`) — подмножество полной жизни таймлайна: как
       только субъект целиком уходит за пределы области прокрутки, таймлайн
       становится НЕАКТИВНЫМ, и действует значение свойства из того же блока
       (`transform: scaleY(0)`), а не последний прогресс. Поэтому конечное
       состояние проверяется, пока рисунок ещё виден, а не «где-нибудь ниже». */
    let done = 0;
    for (let i = 0; i < 80; i++) {
      done = await shaftProgress(page, 2);
      if (done > 0.99) break;
      await page.mouse.wheel(0, 60);
      await page.waitForTimeout(20);
    }
    expect(done, 'стрелка не дорисовалась до конца, пока рисунок ещё виден').toBeGreaterThan(0.99);

    // И числа обязаны прийти к своим значениям — ровно к напечатанным, без
    // «почти»: счётчик возвращает исходную строку, а не пересобранную.
    await expect
      .poll(async () => (await printedValues(page)).map((s) => s.trim()), { timeout: 5_000 })
      .toEqual(CELLS.map((c) => c.value));

    await context.close();
  });
});

/* Сторож правки владельца 2026-08-20 (вечер). Она ОТМЕНЯЕТ утреннюю: та
 * сдвинула окно на `cover 2%…20%`, и владелец увидел обратный дефект —
 * «анимацию для секции „Кейс“ вообще не видно, так как анимация происходит
 * до того, как пользователь перейдет на данный раздел».
 *
 * Требование двустороннее, поэтому и точек замера две:
 *   (а) карточка стоит в кадре ЦЕЛИКОМ — движение ещё НЕ закончено и уже
 *       НАЧАЛОСЬ: читатель видит его своими глазами;
 *   (б) карточка ТОЛЬКО НАЧИНАЕТ уходить вверх — движение уже закончено.
 *
 * Проверяется СЛЕДСТВИЕ, а не доли: тест не переписывает себе `cover
 * 26%…55%` из компонента (вторая копия разошлась бы с первой молча), а
 * прокручивает страницу в две точки, посчитанные из РАСКЛАДКИ на месте, и
 * требует в них разных состояний. Субъект «карточка» — `.row`, весь блок
 * кейса вместе с текстом: именно его владелец называет карточкой, и он
 * заметно выше самого рисунка.
 *
 * Две высоты окна, обе из задания: типовая 1440×900 и ноутбучная 1180×800.
 *
 * Прокрутка ставится `window.scrollTo` мимо Lenis и с двумя кадрами
 * ожидания: значение таймлайна прокрутки коммитит композитор, и замер сразу
 * после установки положения читает предыдущий кадр (та же гонка, что в
 * тесте выше). */
test.describe('иллюстрация «Замер» — движение попадает в окно чтения', () => {
  /** Прокрутка в положение, где заданная кромка карточки совпадает с кромкой
   *  окна. `edge: 'bottom'` — карточка целиком видна впервые; `edge: 'top'` —
   *  карточка начинает уходить вверх. */
  async function scrollToRowEdge(page: Page, edge: 'top' | 'bottom'): Promise<void> {
    const target = await page.locator(ILLO).evaluate((el, e) => {
      const row = (el as HTMLElement).closest('.row') as HTMLElement;
      const box = row.getBoundingClientRect();
      const docTop = box.top + window.scrollY;
      return e === 'bottom' ? docTop + box.height - window.innerHeight : docTop;
    }, edge);
    await page.evaluate((top) => {
      window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
      return new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );
    }, target);
    await page.waitForTimeout(120);
  }

  for (const vp of [{ width: 1440, height: 900 }, { width: 1180, height: 800 }]) {
    test(`${vp.width}×${vp.height}: карточка целиком в кадре — движение ещё идет`, async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: vp });
      const page = await context.newPage();
      await page.goto('/');
      await scrollToRowEdge(page, 'bottom');

      // Карточка действительно видна целиком — иначе проверка ниже говорила
      // бы о моменте, которого владелец не имел в виду.
      const visible = await page.locator(ILLO).evaluate((el) => {
        const b = ((el as HTMLElement).closest('.row') as HTMLElement).getBoundingClientRect();
        return b.top >= -1 && b.bottom <= window.innerHeight + 1;
      });
      expect(visible, 'карточка не помещается в окно целиком в замеренной точке').toBe(true);

      // Уже началось: неподвижный рисунок в этот момент — это ровно тот
      // дефект, из-за которого правка и делается.
      expect(
        await shaftProgress(page, 1),
        'первый отрезок стрелки ещё не начат, когда карточка уже целиком в кадре',
      ).toBeGreaterThan(0.05);

      // И ещё не закончилось: движение обязано происходить у читателя на
      // глазах, а не до того, как он сюда доберется.
      expect(
        await shaftProgress(page, 2),
        'движение уже закончено в тот момент, когда карточка только встала в кадр целиком — ' +
          'читатель его не увидит',
      ).toBeLessThan(0.99);

      await context.close();
    });

    test(`${vp.width}×${vp.height}: карточка пошла вверх — все закончено`, async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: vp });
      const page = await context.newPage();
      await page.goto('/');
      await scrollToRowEdge(page, 'top');

      for (const seg of [1, 2]) {
        expect(
          await shaftProgress(page, seg),
          `отрезок ${seg} не дорисован к моменту, когда карточка начала уходить вверх`,
        ).toBeGreaterThan(0.99);
      }
      expect(
        await page.locator(`${ILLO} [data-cell="verdict"]`).evaluate((el) => getComputedStyle(el).opacity),
        'вывод ещё не проявлен к моменту, когда карточка начала уходить вверх',
      ).toBe('1');
      expect(
        (await printedValues(page)).map((s) => s.trim()),
        'числа ещё крутятся к моменту, когда карточка начала уходить вверх',
      ).toEqual(CELLS.map((c) => c.value));

      await context.close();
    });
  }
});

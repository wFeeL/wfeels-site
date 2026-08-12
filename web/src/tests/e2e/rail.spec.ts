import { test, expect } from '@playwright/test';
import { HOME_SECTIONS } from '../../lib/sections';

/* Ширина берётся из общего списка точек перелома в tokens.css — 1100 px,
   рельс появляется на ней и выше. Проверяются оба края границы: 1099 (рельса
   ещё нет) и 1101 (полосы уже нет). Плана задача 4: «ни при каком размере не
   должно быть ни того ни другого». */
const WIDE = { width: 1280, height: 900 };

/* Секции задачи 2 — заглушки без утверждённого текста (задача 1 плана), и
   каждая заметно короче, чем понесёт настоящий контент задач 5–13. При
   высоте 900 px суммарная высота одиннадцати заглушек не даёт браузеру
   докрутить последние секции до верхней границы окна — `contact` и `faq`
   упираются в физический предел прокрутки в одной и той же позиции, и
   никакой алгоритм не отличит по чистому `scrollY` «докрутили до faq» от
   «докрутили до contact». Более низкое окно оставляет достаточно места для
   прокрутки, чтобы каждая секция стала различима, и не имеет отношения к
   самому рельсу — это свойство высоты страницы, а не его логики. */
const SPY_VIEWPORT = { width: 1280, height: 500 };

test.describe('рельс — точка перелома 1100 px (главная)', () => {
  test('на 1099 px рельса нет, полоса прогресса видна', async ({ page }) => {
    await page.setViewportSize({ width: 1099, height: 900 });
    await page.goto('/');
    await expect(page.locator('nav.rail')).toBeHidden();
    await expect(page.locator('#reading-progress')).toBeVisible();
  });

  test('на 1101 px рельс виден, полосы прогресса нет', async ({ page }) => {
    await page.setViewportSize({ width: 1101, height: 900 });
    await page.goto('/');
    await expect(page.locator('nav.rail')).toBeVisible();
    await expect(page.locator('#reading-progress')).toBeHidden();
  });

  // Другие страницы рельса не несут вовсе (`rail` не передан в `Base`) — на
  // них полоса видна при любой ширине, как до этой задачи.
  test('на посадочной без рельса полоса видна и на 1280 px', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/contact');
    await expect(page.locator('nav.rail')).toHaveCount(0);
    await expect(page.locator('#reading-progress')).toBeVisible();
  });
});

test.describe('рельс — роль и разметка', () => {
  test('рельс — навигация с подписанными точками', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');
    const nav = page.locator('nav.rail');
    await expect(nav).toHaveAttribute('aria-label', /.+/);
    const points = nav.locator('button.point');
    await expect(points).toHaveCount(7);
    for (const btn of await points.all()) {
      await expect(btn).toHaveAttribute('aria-label', /.+/);
    }
  });

  // Рельс лежит в разметке после `<main>` и после `<footer>` (`Base.astro`),
  // а не внутри `<main>`: DOM-порядок определяет таб-порядок при отсутствии
  // положительного `tabindex`, значит фокус клавиатуры идёт через содержимое
  // страницы и подвал раньше, чем доходит до точек рельса — рельс не
  // перехватывает его первым, хотя визуально стоит поверх контента.
  test('рельс в DOM-порядке идёт после main и подвала', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');
    const order = await page.evaluate(() => {
      const rail = document.querySelector('nav.rail');
      const main = document.querySelector('main');
      const footer = document.querySelector('footer');
      if (!rail || !main || !footer) return null;
      const after = (a: Element, b: Element) =>
        !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return after(main, rail) && after(footer, rail);
    });
    expect(order, 'рельс стоит раньше main или подвала в DOM').toBe(true);
  });
});

/* Два теста ниже закрывают починку коммита 235e752 «Выровнять точки рельса,
 * подписать все семь и ужать мобильную шапку» тестами — до этой задачи
 * починка держалась на честном слове (снимок `/tmp/rail-after.png`, не
 * тест). Дефекты, зафиксированные в комментарии `Rail.astro` над `.label`:
 *
 *   дефект 1 — без фиксированной ширины подписи ширина всей группы
 *   «точка+подпись» зависела от длины слова, и точка гуляла по горизонтали
 *   вместе с текстом вместо того, чтобы стоять со всеми на одной вертикали;
 *   дефект 2 — подпись была не видна по умолчанию (`opacity: 0`), видна
 *   только у наведённой/сфокусированной/активной точки — шесть точек из
 *   семи не несли имени вовсе.
 *
 * Проверяется фактическими координатами (дефект 1) и фактической
 * вычисленной прозрачностью (дефект 2), а не наличием класса — оба дефекта
 * были в разметке, у которой класс `.label` уже был на месте. */
test.describe('рельс — семь точек на одной вертикали, все с подписью', () => {
  const EXPECTED_LABELS = [
    'НАЧАЛО', 'УСЛУГИ', 'ЦЕНЫ', 'КЕЙСЫ', 'ПРОЦЕСС', 'ОБО МНЕ', 'КОНТАКТ',
  ];

  test('все семь подписей присутствуют, дословно и в порядке спеки', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');
    const labels = page.locator('nav.rail .point .label');
    await expect(labels).toHaveCount(7);
    expect(await labels.allTextContents()).toEqual(EXPECTED_LABELS);
  });

  test('все семь подписей видимы без наведения — не opacity: 0 по умолчанию', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');
    const labels = page.locator('nav.rail .point .label');
    const opacities = await labels.evaluateAll(
      (els) => els.map((el) => getComputedStyle(el).opacity),
    );
    for (const [i, opacity] of opacities.entries()) {
      expect(Number(opacity), `подпись «${EXPECTED_LABELS[i]}»: opacity ${opacity}`)
        .toBeGreaterThan(0);
    }
  });

  test('правый край подписи и центр точки — одна вертикаль у всех семи', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');

    const points = page.locator('nav.rail .point');
    await expect(points).toHaveCount(7);

    const geometry = await points.evaluateAll((els) => els.map((el) => {
      const dot = el.querySelector('.dot')!.getBoundingClientRect();
      const label = el.querySelector('.label')!.getBoundingClientRect();
      return { dotCenterX: dot.x + dot.width / 2, labelRightEdge: label.x + label.width };
    }));

    const dotCenters = geometry.map((g) => g.dotCenterX);
    const labelRightEdges = geometry.map((g) => g.labelRightEdge);

    // Допуск 0,5 px — под субпиксельный рендеринг, не под расхождение по сути.
    const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
    expect(spread(dotCenters), `центры точек: ${dotCenters.join(', ')}`).toBeLessThan(0.5);
    expect(spread(labelRightEdges), `правые края подписей: ${labelRightEdges.join(', ')}`)
      .toBeLessThan(0.5);
  });
});

/* Линия отсчёта скроллспая (Rail.astro, script) стоит на трети высоты окна
 * вниз от его верха, а не у самой верхней кромки (полировка перед приёмкой,
 * находка 1, 2026-08-12). Тест ниже прокручивает каждую секцию к верху окна
 * (`scrollIntoView({ block: 'start' })`) — при таком скролле верх секции
 * совпадает со scrollY, и он остаётся достаточно надёжной проверкой того, что
 * группировка секций в точки не сломана: при настоящем тексте секций (не
 * заглушках) следующая секция начинается заметно дальше, чем на треть высоты
 * окна ниже, так что линия отсчёта не перескакивает через границу. Саму
 * механику «активируется на трети высоты, а не когда предыдущая секция
 * покинула кадр целиком» проверяет отдельный блок ниже, где секция
 * сознательно НЕ докручена до верха. */
test.describe('рельс — подсветка активной точки по прокрутке', () => {
  for (const section of HOME_SECTIONS) {
    test(`секция «${section.id}» подсвечивает точку «${section.railLabel}»`,
      async ({ page }) => {
        await page.setViewportSize(SPY_VIEWPORT);
        await page.goto('/');
        // `scrollIntoViewIfNeeded` не делает ничего, если секция уже видна
        // целиком (заглушки задачи 2 короче окна) — прокрутка форсируется
        // явно, так же, как это делает клик по точке рельса.
        await page.evaluate((id) => {
          document.getElementById(id)?.scrollIntoView({ block: 'start' });
        }, section.id);

        await expect
          .poll(() => page.locator('.rail .point.active').count(), {
            message: `секция ${section.id}: ни одна точка не активна`,
          })
          .toBe(1);

        const active = page.locator('.rail .point.active');
        await expect(active).toHaveAttribute('aria-label', section.railLabel);
        await expect(active).toHaveAttribute('aria-current', 'true');
      });
  }
});

/* Находка 1 полировки перед приёмкой (2026-08-12): глаз и рельс расходились —
 * заголовок следующего раздела уже стоял крупно в кадре, а рельс ещё называл
 * предыдущий, потому что старое правило ждало, пока верх предыдущей секции
 * целиком уйдёт за верхнюю границу окна. Тест ниже воспроизводит именно этот
 * случай на границе «Цены → Кейсы» из отчёта о находке: докручивает не до
 * верха секции «cases» (как тест выше), а до положения по обе стороны от
 * линии отсчёта — трети высоты окна — и проверяет, что переключение точки
 * происходит ровно на этой линии, а не раньше и не позже. */
test.describe('рельс — линия отсчёта на трети высоты окна, а не на верхней кромке', () => {
  test('точка следующего раздела активна уже тогда, когда его заголовок вошёл в верхнюю треть окна — раздел ещё не долистан до самого верха и предыдущий ещё частично виден', async ({ page }) => {
    await page.setViewportSize(SPY_VIEWPORT);
    await page.goto('/');

    const casesTop = await page.evaluate(
      () => document.getElementById('cases')!.offsetTop,
    );
    const line = SPY_VIEWPORT.height / 3;

    // Чуть выше линии отсчёта: верх «cases» ещё не дошёл до трети окна —
    // по старому правилу «за верхней кромкой» это тоже была бы «ЦЕНЫ», но
    // здесь проверяется именно новое правило, а не совпадение со старым.
    await page.evaluate((y) => window.scrollTo(0, y), casesTop - line - 24);
    await expect
      .poll(() => page.locator('.rail .point.active').getAttribute('aria-label'))
      .toBe('ЦЕНЫ');

    // На 24 px ниже — верх «cases» пересёк линию отсчёта. Секция «cases»
    // при этом занимает только нижние две трети окна, верх экрана всё ещё
    // показывает хвост секции «pricing»: если бы правило было «предыдущая
    // секция покинула кадр», точка осталась бы на «ЦЕНЫ».
    await page.evaluate((y) => window.scrollTo(0, y), casesTop - line + 24);
    await expect
      .poll(() => page.locator('.rail .point.active').getAttribute('aria-label'))
      .toBe('КЕЙСЫ');
  });
});

test.describe('рельс — клик по точке', () => {
  test('доводит прокрутку до первой секции точки', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');
    await page.locator('.rail .point[aria-label="ПРОЦЕСС"]').click();

    await expect
      .poll(() => page.evaluate(() => {
        const target = document.getElementById('process');
        return target ? Math.abs(window.scrollY - target.offsetTop) : null;
      }), { timeout: 3000 })
      .toBeLessThan(4);
  });

  test('при уменьшенном движении прокрутка всё равно доходит до цели',
    async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.setViewportSize(WIDE);
      await page.goto('/');
      await page.locator('.rail .point[aria-label="ОБО МНЕ"]').click();

      await expect
        .poll(() => page.evaluate(() => {
          const target = document.getElementById('about');
          return target ? Math.abs(window.scrollY - target.offsetTop) : null;
        }), { timeout: 3000 })
        .toBeLessThan(4);

      await ctx.close();
    });
});

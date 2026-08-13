import { test, expect } from '@playwright/test';
import { HOME_SECTIONS } from '../../lib/sections';

/* Ширина берётся из общего списка точек перелома в tokens.css — 1600 px,
   рельс появляется на ней и выше. Design-ревью 2026-08-12 подняло порог с
   1100 до 1400 px, но 1400 — тоже невычисленное число: по формуле границ
   контейнера (max-width 1180, padding-inline 40) и рельса (200 px + отступ
   24 px) они физически перестают пересекаться только с 1548 px, что и
   подтверждает блок «не пересекает панель» ниже прямым измерением
   `getBoundingClientRect()` — на 1400 px пересечение остаётся 74 px, на
   1440 px — 54 px. Порог здесь взят 1600 px: круглое число с запасом
   поверх 1548 px, совпадающее с одной из проверяемых ширин. Плана задача 4:
   «ни при каком размере не должно быть ни рельса, ни полосы вместе, ни
   пустоты без обоих». */
const WIDE = { width: 1600, height: 900 };

/* Секции задачи 2 — заглушки без утверждённого текста (задача 1 плана), и
   каждая заметно короче, чем понесёт настоящий контент задач 5–13. При
   высоте 900 px суммарная высота одиннадцати заглушек не даёт браузеру
   докрутить последние секции до верхней границы окна — `contact` и `faq`
   упираются в физический предел прокрутки в одной и той же позиции, и
   никакой алгоритм не отличит по чистому `scrollY` «докрутили до faq» от
   «докрутили до contact». Более низкое окно оставляет достаточно места для
   прокрутки, чтобы каждая секция стала различима, и не имеет отношения к
   самому рельсу — это свойство высоты страницы, а не его логики. */
// Скроллспай-тесты держатся на низком окне (см. комментарий выше), но должны
// видеть рельс — при пороге 1600 px ширина обязана быть не меньше него.
const SPY_VIEWPORT = { width: 1600, height: 500 };

test.describe('рельс — точка перелома 1600 px (главная)', () => {
  test('на 1599 px рельса нет, полоса прогресса видна', async ({ page }) => {
    await page.setViewportSize({ width: 1599, height: 900 });
    await page.goto('/');
    await expect(page.locator('nav.rail')).toBeHidden();
    await expect(page.locator('#reading-progress')).toBeVisible();
  });

  test('на 1601 px рельс виден, полосы прогресса нет', async ({ page }) => {
    await page.setViewportSize({ width: 1601, height: 900 });
    await page.goto('/');
    await expect(page.locator('nav.rail')).toBeVisible();
    await expect(page.locator('#reading-progress')).toBeHidden();
  });

  // Находка design-ревью 2026-08-12: при прежнем пороге 1100 px рельс
  // печатался поверх карточек на 1100–1350 px, при названных ревью 1400 px
  // пересечение ещё оставалось (см. комментарий выше и блок «не пересекает
  // панель»). На этих трёх ширинах рельса быть не должно вовсе — только
  // полоса.
  for (const width of [1280, 1366, 1440]) {
    test(`на ${width} px (был центр находки или назывался ревью) рельса нет, полоса видна`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.locator('nav.rail')).toBeHidden();
      await expect(page.locator('#reading-progress')).toBeVisible();
    });
  }

  // Другие страницы рельса не несут вовсе (`rail` не передан в `Base`) — на
  // них полоса видна при любой ширине, как до этой задачи.
  test('на посадочной без рельса полоса видна и на 1600 px', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/contact');
    await expect(page.locator('nav.rail')).toHaveCount(0);
    await expect(page.locator('#reading-progress')).toBeVisible();
  });
});

/* Требование B2 (design-ревью 2026-08-12): «рельс никому не мешает», а не
 * только «рельс виден» — прежний тест проверял исключительно видимость, не
 * пересечение. Проверяется на четырёх ширинах, названных ревью для этой
 * проверки: 1400, 1440, 1600, 1920. Ни на одной из них панель и рельс не
 * пересекаются — на 1400 и 1440 px потому, что рельс при пороге 1600 px там
 * не рисуется вовсе (пересекаться нечему), на 1600 и 1920 px — потому что
 * рельс виден и физически помещается рядом с панелью. Тест это различает
 * явно, а не считает отсутствие рельса «неприменимой» проверкой: и то, и
 * другое состояние обязано означать «панель никто не перекрывает». Измеряется
 * фактическими `getBoundingClientRect()`, а не рассчитывается заранее —
 * расчёт от руки уже подвёл однажды с числом 1400 в этой самой задаче. */
test.describe('рельс — не пересекает панель ни на одной проверенной ширине', () => {
  for (const width of [1400, 1440, 1600, 1920]) {
    test(`на ${width} px рельс не пересекает панель (виден и не пересекает, либо не рисуется вовсе)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      const railVisible = await page.locator('nav.rail').isVisible();

      if (!railVisible) {
        // Ниже 1600 px рельса нет вовсе — пересекать панель нечему. Полоса
        // прогресса обязана быть на месте, иначе это не «рельса нет», а
        // «пропали оба», что тот же дефект в другой форме.
        await expect(page.locator('#reading-progress')).toBeVisible();
        return;
      }

      const geometry = await page.evaluate(() => {
        // Первый `<section>` внутри `<main>` — панель главной содержимого,
        // тот же элемент, чей правый край мерило design-ревью.
        const panel = document.querySelector('main section');
        const rail = document.querySelector('nav.rail');
        if (!panel || !rail) return null;
        return {
          panelRight: panel.getBoundingClientRect().right,
          railLeft: rail.getBoundingClientRect().left,
        };
      });

      expect(geometry, 'не нашлась панель или рельс в разметке').not.toBeNull();
      expect(
        geometry!.panelRight,
        `на ${width} px панель (правый край ${geometry!.panelRight}) заходит за ` +
        `рельс (левый край ${geometry!.railLeft})`,
      ).toBeLessThanOrEqual(geometry!.railLeft);
    });
  }
});

test.describe('рельс — роль и разметка', () => {
  test('рельс — навигация с подписанными точками', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');
    const nav = page.locator('nav.rail');
    await expect(nav).toHaveAttribute('aria-label', /.+/);
    const points = nav.locator('button.point');
    await expect(points).toHaveCount(8);
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
 * были в разметке, у которой класс `.label` уже был на месте.
 *
 * Точек стало восемь, не семь: правка владельца 2026-08-13 расцепила
 * «ПРОЦЕСС» и «ГАРАНТИИ» (`lib/sections.ts`) — у секции 8 «Что я гарантирую»
 * появилась своя точка рельса. */
test.describe('рельс — восемь точек на одной вертикали, все с подписью', () => {
  const EXPECTED_LABELS = [
    'НАЧАЛО', 'УСЛУГИ', 'ЦЕНЫ', 'КЕЙСЫ', 'ПРОЦЕСС', 'ГАРАНТИИ', 'ОБО МНЕ', 'КОНТАКТ',
  ];

  test('все восемь подписей присутствуют, дословно и в порядке спеки', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');
    const labels = page.locator('nav.rail .point .label');
    await expect(labels).toHaveCount(8);
    expect(await labels.allTextContents()).toEqual(EXPECTED_LABELS);
  });

  test('все восемь подписей видимы без наведения — не opacity: 0 по умолчанию', async ({ page }) => {
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

  test('правый край подписи и центр точки — одна вертикаль у всех восьми', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');

    const points = page.locator('nav.rail .point');
    await expect(points).toHaveCount(8);

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

/* Клик по точке рельса зовёт `target.scrollIntoView({ block: 'start' })`
   (`Rail.astro`) — браузер сам вычитает `scroll-margin-top` цели
   (`Section.astro`, правка владельца 2026-08-13, задача 1: липкая шапка не
   должна закрывать секцию при прокрутке к якорю). Раньше `scroll-margin-top`
   не было, и клик доводил `scrollY` ровно до `target.offsetTop` — то есть
   секция вставала верхним краем точно под шапку, не под неё. Ожидание теста
   читает `scroll-margin-top` цели из вычисленных стилей вместо того, чтобы
   хранить число второй раз здесь. */
test.describe('рельс — клик по точке', () => {
  test('доводит прокрутку до первой секции точки, с запасом под липкую шапку', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');
    await page.locator('.rail .point[aria-label="ПРОЦЕСС"]').click();

    await expect
      .poll(() => page.evaluate(() => {
        const target = document.getElementById('process');
        if (!target) return null;
        const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
        return Math.abs(window.scrollY - (target.offsetTop - margin));
      }), { timeout: 3000 })
      .toBeLessThan(4);
  });

  test('при уменьшенном движении прокрутка всё равно доходит до цели, с тем же запасом',
    async ({ browser }) => {
      const ctx = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await page.setViewportSize(WIDE);
      await page.goto('/');
      await page.locator('.rail .point[aria-label="ОБО МНЕ"]').click();

      await expect
        .poll(() => page.evaluate(() => {
          const target = document.getElementById('about');
          if (!target) return null;
          const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
          return Math.abs(window.scrollY - (target.offsetTop - margin));
        }), { timeout: 3000 })
        .toBeLessThan(4);

      await ctx.close();
    });
});

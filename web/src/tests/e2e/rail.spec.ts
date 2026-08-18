/* Позиции считаются `getBoundingClientRect().top + scrollY`, а не `offsetTop`:
   последний отсчитывается от ближайшего ПОЗИЦИОНИРОВАННОГО предка, а не от
   документа. Пока секции лежали плоско, разницы не было; после перестройки
   разметки (`HomeSection`, 2026-08-13) такой предок появился, и тесты показали
   промах в 877 px там, где прокрутка приезжала точно. Ломалась система
   отсчёта, а не поведение. */
import { test, expect } from '@playwright/test';
import { HOME_SECTIONS } from '../../lib/sections';

/* Точка перелома рельса — 1324 px, посчитана в `tokens.css`/`Rail.astro`, а не
   выбрана: владелец 2026-08-13 опустил её с 1600 px вместе с самим рельсом
   (кружки вместо подписанных точек, ширина 200 → 48 px), потом контейнер
   вернулся 1060 → 1180 px тем же днём (замер: узкий контейнер давал вдвое
   больше переносов), и порог пересчитался следом. Формула:

     viewport = контейнер + 2×(отступ рельса + ширина рельса)
              = 1180      + 2×(24              + 48)
              = 1180      + 144
              = 1324

   Формула НЕ вычитает 2×паддинг контейнера (прежняя редакция этого
   комментария заявляла обратное — проверено фактическим расчётом чисел до
   правки: 1060+144=1204 без вычитания, 32/32 `rail.spec.ts` были зелёные
   именно при этом числе).

   Число здесь не хранится вторым литералом «для теста»: константа читает
   единственное место расчёта — комментарий у `.rail`/`@media` в `Rail.astro`.
   Числа в `RAIL_THRESHOLD` ниже обязаны совпасть с ним при следующей правке
   вручную — тест на срабатывание порога (`±1 px` вокруг) ловит расхождение,
   если кто-то поправит один файл и забудет другой. */
const RAIL_THRESHOLD = 1324;

/* Широкий экран для тестов, которым важна не сама точка перелома, а факт, что
   рельс на этой ширине точно есть — например, разметка и роль, скроллспай,
   клик по точке. 1600 px — круглое число с большим запасом над порогом
   (1324 px), не завязанное на его точное значение: сдвинь порог завтра ещё
   раз, эти тесты не заметят. */
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
// видеть рельс — ширина обязана быть не меньше порога.
const SPY_VIEWPORT = { width: 1600, height: 500 };

test.describe(`рельс — точка перелома ${RAIL_THRESHOLD} px (главная)`, () => {
  test(`на ${RAIL_THRESHOLD - 1} px рельса нет, полоса прогресса видна`, async ({ page }) => {
    await page.setViewportSize({ width: RAIL_THRESHOLD - 1, height: 900 });
    await page.goto('/');
    await expect(page.locator('nav.rail')).toBeHidden();
    await expect(page.locator('#reading-progress')).toBeVisible();
  });

  test(`на ${RAIL_THRESHOLD} px рельс виден, полосы прогресса нет`, async ({ page }) => {
    await page.setViewportSize({ width: RAIL_THRESHOLD, height: 900 });
    await page.goto('/');
    await expect(page.locator('nav.rail')).toBeVisible();
    await expect(page.locator('#reading-progress')).toBeHidden();
  });

  // Другие страницы рельса не несут вовсе (`rail` не передан в `Base`) — на
  // них полоса видна при любой ширине, как до этой задачи.
  test('на посадочной без рельса полоса видна и на широком экране', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/contact');
    await expect(page.locator('nav.rail')).toHaveCount(0);
    await expect(page.locator('#reading-progress')).toBeVisible();
  });
});

/* Требование B2 (design-ревью 2026-08-12, актуально и после правки владельца
 * 2026-08-13): «рельс никому не мешает», а не только «рельс виден» — тест,
 * проверяющий одну лишь видимость и не проверяющий пересечение с панелью,
 * уже был здесь дефектом однажды. Ширины ниже — порог ровно, порог с малым
 * запасом и частые ширины ноутбука/монитора, которые остаются выше порога
 * 1324 px (пересчитан 2026-08-13 вместе с возвратом контейнера 1060 → 1180 px)
 * и обязаны не только показать рельс, но и не дать ему наехать на панель.
 * 1280 px из этого списка исключён этой же правкой — при контейнере 1180 px
 * он опустился НИЖЕ нового порога и легитимно остаётся без рельса (его
 * покрывает первый блок теста через `RAIL_THRESHOLD − 1`). Измеряется
 * фактическими `getBoundingClientRect()`, а не рассчитывается заранее —
 * расчёт от руки уже подводил однажды с числом 1400 в этой самой задаче. */
test.describe('рельс — виден и не пересекает панель на типичных ширинах ноутбука и монитора', () => {
  for (const width of [RAIL_THRESHOLD, RAIL_THRESHOLD + 40, 1366, 1440, 1600, 1920]) {
    test(`на ${width} px рельс виден и не пересекает панель`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      await expect(page.locator('nav.rail')).toBeVisible();

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
    await expect(points).toHaveCount(10);
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

/* Правка владельца 2026-08-13 («Рельс: кружки, подпись только у активной
 * точки, как было в v2»): рельс больше не показывает семь-восемь подписей
 * разом (то была починка более раннего дефекта, теперь отменённая владельцем
 * своим же решением) — видимо ровно ноль или одна подпись, у активной точки.
 * Доступность при этом не теряется: `aria-label` кнопки не зависит от
 * визуального состояния подписи (проверено выше, «роль и разметка»), а текст
 * `.label` остаётся в DOM и у скрытых точек — читает его `textContent`, а не
 * видимость, поэтому блок ниже проверяет ТЕКСТ подписей отдельно от их
 * ВИДИМОСТИ.
 *
 * Правка владельца 2026-08-18 (пункт 23): `pain` и `faq` получили
 * собственные точки — восемь подписей стало десять, «БОЛЬ» и «FAQ». */
test.describe('рельс — десять подписей в DOM, видима только у активной точки', () => {
  const EXPECTED_LABELS = [
    'НАЧАЛО', 'БОЛЬ', 'УСЛУГИ', 'ЦЕНЫ', 'КЕЙСЫ', 'ПРОЦЕСС', 'ГАРАНТИИ', 'ОБО МНЕ', 'FAQ', 'КОНТАКТ',
  ];

  test('все десять подписей присутствуют в DOM, дословно и в порядке спеки', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');
    const labels = page.locator('nav.rail .point .label');
    await expect(labels).toHaveCount(10);
    expect(await labels.allTextContents()).toEqual(EXPECTED_LABELS);
  });

  test('в состоянии покоя (верх страницы) видима ровно одна подпись — у первой точки', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');

    const labels = page.locator('nav.rail .point .label');

    /* Мгновенный замер после `goto` попадал не в состояние покоя, а в гонку:
       скроллспай — модульный скрипт, он выполняется после разбора документа,
       и подпись активной точки раскрывается переходом `max-width` (Rail.astro).
       Ждём назначения точки и доигранного перехода — и только потом считаем.

       Строгость проверки при этом не падает: `expect.poll` всё равно упадёт,
       если подпись не раскроется вовсе или раскроется не одна. Ослаблением
       было бы убрать сравнение с единицей, а не дождаться конца перехода. */
    await expect(page.locator('.rail .point.active')).toHaveCount(1);

    const visibleWidths = async () =>
      (await labels.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width)))
        .filter((w) => w > 0);

    await expect
      .poll(async () => (await visibleWidths()).length, {
        message: 'видимых подписей в состоянии покоя',
      })
      .toBe(1);

    const active = page.locator('.rail .point.active .label');
    await expect(active).toHaveText('НАЧАЛО');
  });

  test('неактивная подпись невидима глазу (нулевая ширина), но остаётся текстом для читалки', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');

    const inactive = page.locator('.rail .point:not(.active) .label').first();
    await expect(inactive).toHaveCSS('max-width', '0px');
    // `.label` несёт `aria-hidden="true"` намеренно (имя точки читает
    // `aria-label` кнопки, см. «роль и разметка» выше) — но сам текст в DOM
    // остаётся, что и проверяет тест выше («все восемь подписей присутствуют
    // в DOM»). Здесь — что визуально он и правда скрыт, а не просто узкий.
    const width = await inactive.evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBe(0);
  });

  /* Кружки без подписей не сообщают, КУДА можно перейти. Наведение раскрывает
     подпись именно неактивной точки — это и есть её назначение как навигации
     (владелец 2026-08-13). Тест мерит фактическую ширину, а не наличие правила
     в CSS: правило можно написать и перекрыть соседним, а ширину — нет. */
  test('наведение на неактивную точку раскрывает её подпись', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');

    const point = page.locator('.rail .point:not(.active)').first();
    const label = point.locator('.label');
    const text = await label.textContent();

    expect(await label.evaluate((el) => el.getBoundingClientRect().width)).toBe(0);

    await point.hover();
    await expect
      .poll(async () => label.evaluate((el) => el.getBoundingClientRect().width), {
        message: `ширина подписи «${text}» под курсором`,
      })
      .toBeGreaterThan(0);
  });

  test('клавиатурный фокус раскрывает подпись так же, как наведение', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');

    const point = page.locator('.rail .point:not(.active)').first();
    const label = point.locator('.label');

    await point.focus();
    await expect
      .poll(async () => label.evaluate((el) => el.getBoundingClientRect().width), {
        message: 'ширина подписи под фокусом с клавиатуры',
      })
      .toBeGreaterThan(0);
  });
});

/* Точка не должна «гулять» по горизонтали между активным и неактивным
 * состоянием (комментарий в `Rail.astro`, `.point`): подпись стоит ПЕРЕД
 * точкой в разметке и раскрывается вправо-от-начала, не сдвигая саму точку,
 * которая пакуется к правому краю кнопки через `justify-content: flex-end`
 * независимо от ширины подписи. Тест ниже подтверждает это фактическими
 * координатами, а не структурой разметки — структура уже однажды не
 * гарантировала того, что казалось очевидным (см. историю файла, дефект 1). */
test.describe('рельс — точка не смещается по горизонтали между состояниями', () => {
  test('центр точки — на одной вертикали у всех десяти в состоянии покоя', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');

    const dots = page.locator('nav.rail .point .dot');
    await expect(dots).toHaveCount(10);
    const centers = await dots.evaluateAll(
      (els) => els.map((el) => {
        const r = el.getBoundingClientRect();
        return r.x + r.width / 2;
      }),
    );
    const spread = Math.max(...centers) - Math.min(...centers);
    expect(spread, `центры точек: ${centers.join(', ')}`).toBeLessThan(0.5);
  });

  test('центр конкретной точки не сдвигается, когда именно она становится активной', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');

    const point = page.locator('.rail .point[aria-label="ПРОЦЕСС"]');
    const dot = point.locator('.dot');

    const before = await dot.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.x + r.width / 2;
    });

    // Раздел ещё не активен (страница на самом верху) — клик по точке
    // прокручивает и активирует её, подпись открывается.
    await point.click();
    await expect(point).toHaveClass(/active/);

    const after = await dot.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.x + r.width / 2;
    });

    expect(Math.abs(after - before), `центр точки: было ${before}, стало ${after}`)
      .toBeLessThan(0.5);
  });
});

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
      () => { const el = document.getElementById('cases')!;
              return el.getBoundingClientRect().top + window.scrollY; },
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
        const top = target.getBoundingClientRect().top + window.scrollY;
        return Math.abs(window.scrollY - (top - margin));
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
          const top = target.getBoundingClientRect().top + window.scrollY;
        return Math.abs(window.scrollY - (top - margin));
        }), { timeout: 3000 })
        .toBeLessThan(4);

      await ctx.close();
    });
});

/* Находка 2 дизайн-ревью: `top: 50%` центрировал рельс по всему вьюпорту, не
 * зная о липкой шапке (65px). Десять точек (правка владельца 2026-08-18,
 * пункт 23) дают высоту 476px вместо прежних 380px у восьми — первая точка
 * стала заходить под шапку уже на обычных ноутбучных высотах: на 1366×620
 * зазор был 7px, на 1366×560 точка «НАЧАЛО» резалась пополам. `Rail.astro`
 * теперь берёт `top` как БОЛЬШЕЕ из «центр минус половина рельса» и «низ
 * шапки плюс 24px» — ниже 654px высоты действует аварийный пол с постоянным
 * зазором 24px, выше — обычное центрирование, как и было. Тест меряет
 * фактические `getBoundingClientRect()` на высотах из отчёта ревью, а не
 * полагается на формулу — формула уже однажды разошлась с измерением в этом
 * же компоненте (см. историю порога 1324px выше в этом файле). */
test.describe('рельс — не заходит под шапку на низких ноутбучных высотах', () => {
  for (const height of [560, 606, 620, 654]) {
    test(`1366×${height}: первая точка «НАЧАЛО» видна целиком под шапкой`, async ({ page }) => {
      await page.setViewportSize({ width: 1366, height });
      await page.goto('/');

      const geometry = await page.evaluate(() => {
        const header = document.querySelector('header');
        const first = document.querySelector('nav.rail .point');
        if (!header || !first) return null;
        return {
          headerBottom: header.getBoundingClientRect().bottom,
          pointTop: first.getBoundingClientRect().top,
        };
      });

      expect(geometry, 'не нашлась шапка или первая точка рельса').not.toBeNull();
      expect(
        geometry!.pointTop,
        `на 1366×${height} верх первой точки (${geometry!.pointTop}) выше низа шапки ` +
          `(${geometry!.headerBottom}) — точка частично скрыта под шапкой`,
      ).toBeGreaterThanOrEqual(geometry!.headerBottom);
    });
  }

  test('на просторной высоте (900px) рельс по-прежнему центрирован — правка не поменяла обычный режим', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/');

    const railTop = await page.locator('nav.rail').evaluate((el) => el.getBoundingClientRect().top);
    // Центр 900px минус половина рельса (238px, см. Rail.astro): 450-238=212.
    expect(Math.abs(railTop - 212), `верх рельса: ${railTop}, ожидалось ~212`).toBeLessThan(1);
  });
});

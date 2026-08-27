import { test, expect } from '@playwright/test';
import { LINE_PATHS } from '../../lib/linePaths';
import { HOME_SECTIONS } from '../../lib/sections';

/** Сторож соответствия страницы и реестра (бриф `70-workshop/specs/site-v3/
 *  05-line.md`, раздел 10 шаг 6, «Подключить реестр путей к странице»).
 *
 *  ПРИЧИНА, по которой этот сторож нужен отдельно от контракт-теста
 *  (`linePaths.contract.test.ts`): контракт-тест меряет геометрию ЗАПИСЕЙ
 *  реестра — он ничего не знает о том, что реально нарисовано на странице.
 *  Ровно это и было причиной дефекта, из-за которого этот файл появился:
 *  реестр был нарисован (шаг 4, контракт-тест зелёный), а `Section.astro`
 *  продолжал рисовать геометрию из локальных `runD`/`turnD`
 *  (`backgroundLine.ts`) — «тест мерил реестр, а страница жила своей
 *  жизнью» (отчёт исполнителя шага 6). Без сторожа, который смотрит на САМУ
 *  СТРАНИЦУ, этот рассинхрон снова станет возможным молча: реестр можно
 *  поправить, забыв поправить потребителя, или наоборот.
 *
 *  Проверка прямая: для каждой секции главной и для подвала атрибут `d`
 *  отрисованного `<path>` внутри `svg.line` обязан совпадать СИМВОЛЬНО с
 *  `LINE_PATHS[id].wide` — не «геометрически похож», а тот же самый текст,
 *  потому что сборка не трансформирует `d` никак между TS-строкой и HTML.
 *
 *  ПРАВКА `70-workshop/specs/site-v3/11-line-narrator-brief.md`, раздел 3
 *  П4 (решение D-125): секция может нести ВТОРОЙ `<path class="line-
 *  branch">` в той же коробке — селектор основной проверки сужен до
 *  `:not(.line-branch)` (раздел 4 брифа: «ломается и правится»), а ветви
 *  проверяются СИММЕТРИЧНО отдельным блоком ниже — против
 *  `LINE_PATHS[id].branch`, тем же приёмом («страница рисует не тот путь,
 *  что нарисован реестром» — и обратно).
 *
 *  ПРАВКА `2026-08-27` (раздел 12.4/12.7 того же брифа): у `hero` появился
 *  ТРЕТИЙ `<path class="line-head">` (клин) в той же коробке — той же
 *  природы, что `.line-branch`, и по той же причине основной селектор сужен
 *  ещё раз, до `:not(.line-branch):not(.line-head)`; клин проверяется своим
 *  отдельным блоком ниже, симметрично блоку ветвей. Без этого сужения `hero`
 *  давал бы ДВЕ строки на одну секцию (`wide` и `head`), и вторая красила бы
 *  тест ложным несовпадением с `LINE_PATHS.hero.wide` — ровно так это и
 *  падало здесь до правки: «Received» показывал `d` клина, а не основной
 *  обводки.
 *
 *  ПРАВКА `2026-08-27`, тем же днём, позже (`70-workshop/specs/site-v3/
 *  16-line-digits-and-finale-brief.md`, раздел 3.3, вариант Б «Разгон»,
 *  выбран владельцем): В-4 ПЕРЕОТКРЫТА — подвал СНОВА рисует `.line`
 *  (`LINE_PATHS.footer`, `Footer.astro`). Счётчик ниже возвращается к «+1 за
 *  подвал» (число секций главной плюс одна запись реестра), и подвал
 *  участвует в обеих проверках направления («страница рисует то, что несёт
 *  реестр» и обратно) на общих основаниях — `Footer.astro` несёт
 *  `data-line-side` таким же атрибутом, каким его несут секции
 *  (`Section.astro`), и `owner.id || owner.tagName.toLowerCase()` даёт для
 *  него `'footer'`, совпадающее с ключом `LINE_PATHS.footer`.
 *
 *  Доказательство красноты (без этого сторож — просто прозаическое
 *  обещание, а не тест): отчёт исполнителя воспроизводит падение прямым
 *  экспериментом — временно возвращает рисование из локальной функции
 *  (`backgroundLine.ts`, `runD`) вместо `LINE_PATHS`, показывает, что этот
 *  тест красный, и восстанавливает правку. Здесь, в самом тесте, ничего
 *  переключать не нужно — это описание для тех, кто проверяет сторож
 *  заново после будущей правки. */

test.describe('линия на фоне — страница рисует пути из реестра (05-line.md, раздел 10 шаг 6)', () => {
  test('атрибут d каждого svg.line path совпадает с LINE_PATHS для своей секции', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const rendered = await page.locator('[data-line-side] > svg.line > path:not(.line-branch):not(.line-head)').evaluateAll((paths) =>
      paths.map((p) => {
        const owner = p.closest('[data-line-side]') as HTMLElement;
        const ownerId = owner.id || owner.tagName.toLowerCase();
        return { ownerId, d: p.getAttribute('d') };
      }),
    );

    // Десять секций главной плюс подвал (раздел 3.3 брифа `16-line-digits-
    // and-finale-brief.md`, В-4 переоткрыта, ПРАВКА `2026-08-27`) — «+1 за
    // подвал» возвращено вместе с LINE_PATHS.footer.
    expect(rendered.length, 'на странице не найдено ни одного svg.line path').toBe(
      HOME_SECTIONS.length + 1,
    );

    for (const { ownerId, d } of rendered) {
      const entry = LINE_PATHS[ownerId];
      expect(entry, `в LINE_PATHS нет записи для «${ownerId}», а страница её рисует`).toBeTruthy();
      expect(
        d,
        `«${ownerId}»: атрибут d на странице разошёлся с LINE_PATHS['${ownerId}'].wide — ` +
          `страница рисует не тот путь, что нарисован реестром`,
      ).toBe(entry!.wide);
    }
  });

  test('в LINE_PATHS нет записи, которая не нарисована ни на одной секции страницы', async ({ page }) => {
    // Обратное направление той же проверки: реестр не должен опережать
    // страницу — ключ, который есть в LINE_PATHS, но не встречается в
    // разметке ни одной секции/подвала, значит либо секция переименована,
    // либо запись реестра осиротела.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const ownerIds = await page.locator('[data-line-side]').evaluateAll((els) =>
      els.map((el) => el.id || el.tagName.toLowerCase()),
    );

    for (const key of Object.keys(LINE_PATHS)) {
      expect(ownerIds, `запись LINE_PATHS['${key}'] не соответствует ни одной секции на странице`).toContain(
        key,
      );
    }
  });
});

test.describe('линия на фоне — ветви рисуются из реестра (11-line-narrator-brief.md, раздел 3 П4, решение D-125)', () => {
  test('атрибут d каждого svg.line path.line-branch совпадает с LINE_PATHS[id].branch', async ({ page }) => {
    // От 900px — .line-branch видим только там (BackgroundLine.astro),
    // а видимость через `display:none` не снимает узел из DOM, значит
    // локатор находит его при любой ширине; ширина берётся ≥900px просто
    // для единообразия с остальными сторожами линии.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const rendered = await page.locator('[data-line-side] > svg.line > path.line-branch').evaluateAll((paths) =>
      paths.map((p) => {
        const owner = p.closest('[data-line-side]') as HTMLElement;
        const ownerId = owner.id || owner.tagName.toLowerCase();
        return { ownerId, d: p.getAttribute('d') };
      }),
    );

    const branchIds = Object.keys(LINE_PATHS).filter((id) => Boolean(LINE_PATHS[id].branch));
    expect(rendered.length, 'число нарисованных .line-branch разошлось с числом записей реестра с полем branch').toBe(
      branchIds.length,
    );

    for (const { ownerId, d } of rendered) {
      const entry = LINE_PATHS[ownerId];
      expect(entry?.branch, `в LINE_PATHS['${ownerId}'] нет поля branch, а страница рисует .line-branch`).toBeTruthy();
      expect(
        d,
        `«${ownerId}»: атрибут d у .line-branch разошёлся с LINE_PATHS['${ownerId}'].branch`,
      ).toBe(entry!.branch);
    }
  });

  test('в LINE_PATHS нет поля branch, которое не нарисовано ни на одной секции страницы', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const ownerIdsWithBranch = await page.locator('[data-line-side]:has(> svg.line > path.line-branch)').evaluateAll((els) =>
      els.map((el) => el.id || el.tagName.toLowerCase()),
    );

    for (const [key, entry] of Object.entries(LINE_PATHS)) {
      if (!entry.branch) continue;
      expect(
        ownerIdsWithBranch,
        `LINE_PATHS['${key}'].branch задан, но на странице у «${key}» нет .line-branch`,
      ).toContain(key);
    }
  });
});

test.describe('линия на фоне — клин hero рисуется из реестра (11-line-narrator-brief.md, раздел 12.4/12.7)', () => {
  test('атрибут d svg.line path.line-head совпадает с LINE_PATHS[id].head', async ({ page }) => {
    // Та же симметрия, что у блока ветвей выше: клин — второй необязательный
    // путь В ТОЙ ЖЕ коробке, того же рода, что `.line-branch`, видим только
    // от 900px (BackgroundLine.astro) — DOM он несёт при любой ширине.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const rendered = await page.locator('[data-line-side] > svg.line > path.line-head').evaluateAll((paths) =>
      paths.map((p) => {
        const owner = p.closest('[data-line-side]') as HTMLElement;
        const ownerId = owner.id || owner.tagName.toLowerCase();
        return { ownerId, d: p.getAttribute('d') };
      }),
    );

    const headIds = Object.keys(LINE_PATHS).filter((id) => Boolean(LINE_PATHS[id].head));
    expect(rendered.length, 'число нарисованных .line-head разошлось с числом записей реестра с полем head').toBe(
      headIds.length,
    );

    for (const { ownerId, d } of rendered) {
      const entry = LINE_PATHS[ownerId];
      expect(entry?.head, `в LINE_PATHS['${ownerId}'] нет поля head, а страница рисует .line-head`).toBeTruthy();
      expect(
        d,
        `«${ownerId}»: атрибут d у .line-head разошёлся с LINE_PATHS['${ownerId}'].head`,
      ).toBe(entry!.head);
    }
  });

  test('в LINE_PATHS нет поля head, которое не нарисовано ни на одной секции страницы', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const ownerIdsWithHead = await page.locator('[data-line-side]:has(> svg.line > path.line-head)').evaluateAll((els) =>
      els.map((el) => el.id || el.tagName.toLowerCase()),
    );

    for (const [key, entry] of Object.entries(LINE_PATHS)) {
      if (!entry.head) continue;
      expect(
        ownerIdsWithHead,
        `LINE_PATHS['${key}'].head задан, но на странице у «${key}» нет .line-head`,
      ).toContain(key);
    }
  });
});

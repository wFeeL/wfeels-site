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

    const rendered = await page.locator('[data-line-side] > svg.line > path:not(.line-branch)').evaluateAll((paths) =>
      paths.map((p) => {
        const owner = p.closest('[data-line-side]') as HTMLElement;
        const ownerId = owner.id || owner.tagName.toLowerCase();
        return { ownerId, d: p.getAttribute('d') };
      }),
    );

    // Десять секций главной + подвал — раздел 10 шаг 4: «одиннадцать путей».
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

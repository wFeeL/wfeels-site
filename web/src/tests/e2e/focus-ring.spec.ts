import { test, expect } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/* Дизайн-ревью 2026-08-22 (находка «три кольца фокуса»): рецензент замерил
 * `outline` на нескольких остановках табуляции и получил три разных значения
 * — 2px синий, 3px почти чёрный (`--text`) и 3px синий. Сторож ниже проходит
 * ВСЕ построенные страницы в ОБЕИХ темах и требует, чтобы `outline` совпадал
 * на КАЖДОЙ остановке табуляции внутри страницы — не только на первой
 * (ловушка 8, `50-code/CLAUDE.md`: проверка обязана покрывать полосу
 * параметров, а не точку).
 *
 * `.status` в LeadForm.astro — намеренное исключение (комментарий у
 * `.status:focus-visible { outline: none }`): панель результата получает
 * фокус программно (`tabindex="-1"`), Tab на неё никогда не попадает, и
 * сторож её не встречает.
 *
 * ПРАВКА 2026-08-23 — каталог вырос с семи страниц до семнадцати (сведение
 * услуг, спека `70-workshop/specs/site-v3/08-service-pages.md`), а список
 * `PAGES` был вписан руками и покрывал только старые семь: ровно ловушка 8 —
 * «сторож мерит верную величину не в том месте», у проверки с параметром
 * «страница» полоса вписана как точка. Список ниже выводится обходом
 * `dist/**\/*.html`, тем же приёмом, что уже применяет `src/tests/dist-
 * links.test.ts` — протухнуть он больше не может, потому что не хранит
 * страницы отдельно от сборки, которая их и породила. */

const DIST = fileURLToPath(new URL('../../../dist/', import.meta.url));

function htmlFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...htmlFiles(p));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/** Файл сборки → маршрут, по которому Playwright открывает страницу.
 *  `index.html` уходит в «чистый» URL своего каталога (так реально ходит
 *  посетитель); `404.html` — особый случай Astro, каталога у него нет, и
 *  маршрут остаётся собственным именем файла (было так и в ручном списке). */
function routeFor(relPath: string): string {
  if (relPath === 'index.html') return '/';
  if (relPath.endsWith('/index.html')) return '/' + relPath.slice(0, -'index.html'.length - 1);
  return '/' + relPath;
}

/* `/dev/ui` — служебная витрина компонентов (`lib/dev-pages.ts`), в боевой
 * сборке маршрута НЕ существует: он появляется в `dist/` только когда сама
 * же сборка запущена с `DEV_PAGES=1` — так делает `webServer` в этом
 * `playwright.config.ts` для нужд e2e (на витрине стоят свои проверки
 * примитивов). Найден на практике: обход дал 18 страниц вместо 17, потому
 * что предыдущий прогон уже пересобрал `dist/` с этим флагом, и он остался
 * на диске к моменту сбора тестов. Исключение поимённое, не молчаливое: без
 * него список страниц зависел бы от того, кто и когда последним запускал
 * сборку — то есть от порядка запуска, а не от состава сайта. */
const EXCLUDED_ROUTES = new Set(['/dev/ui']);

const PAGES = htmlFiles(DIST)
  .map((f) => routeFor(f.slice(DIST.length)))
  .filter((route) => !EXCLUDED_ROUTES.has(route))
  .sort();

const THEMES = ['light', 'dark'] as const;

/** Проходит табуляцией страницу и возвращает `outline`/`outline-offset`
 *  каждой остановки до возврата на первую (циклический обход клавиатурой). */
async function walkFocusRing(page: import('@playwright/test').Page) {
  const stops: { outline: string; offset: string }[] = [];
  let firstId: string | null = null;
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as (HTMLElement & { dataset: DOMStringMap }) | null;
      if (!el || el === document.body) return null;
      if (!el.dataset.__fid) el.dataset.__fid = 'fid' + Math.random().toString(36).slice(2);
      const cs = getComputedStyle(el);
      return {
        fid: el.dataset.__fid,
        outline: `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}`,
        offset: cs.outlineOffset,
      };
    });
    if (!info) break;
    if (firstId === null) firstId = info.fid;
    else if (info.fid === firstId) break; // цикл замкнулся — обошли все остановки
    stops.push({ outline: info.outline, offset: info.offset });
    if (stops.length > 100) break; // предохранитель от зависшего цикла
  }
  return stops;
}

test.describe('сборка построена и список страниц не пуст', () => {
  test('иначе сторож ослеп — сначала `npm run build`', () => {
    expect(
      PAGES.length,
      `нашлось ${PAGES.length} страниц в ${DIST} — сначала выполни \`npm run build\` в web/`,
    ).toBeGreaterThan(10);
    expect(PAGES, 'сама главная').toContain('/');
  });
});

for (const theme of THEMES) {
  test.describe(`кольцо фокуса — тема ${theme}`, () => {
    for (const path of PAGES) {
      test(`${path || '/'}: одно значение outline на всех остановках табуляции`,
        async ({ browser }) => {
          const ctx = await browser.newContext({ colorScheme: theme });
          const page = await ctx.newPage();
          await page.goto(path);

          const stops = await walkFocusRing(page);
          expect(stops.length, 'на странице не нашлось ни одной остановки табуляции — сторож ослеп')
            .toBeGreaterThan(0);

          const variants = new Set(stops.map((s) => `${s.outline} | offset ${s.offset}`));
          expect(
            [...variants],
            `страница ${path} даёт ${variants.size} разных колец фокуса на ${stops.length} остановках вместо одного`,
          ).toHaveLength(1);

          await ctx.close();
        });
    }
  });
}

/* Находка владельца 2026-08-31: у контейнеров с `tabindex="-1"` (Tab на них
 * никогда не попадает — они не входят в цикл `walkFocusRing` выше и потому
 * невидимы для проверки над этим комментарием) программный или WebKit-
 * туда-уехавший фокус получал ТО ЖЕ кольцо периметром, что и настоящие
 * интерактивные цели. На `<main id="main" tabindex="-1">` — самом высоком
 * узле страницы — это кольцо растягивалось на всю высоту документа и
 * читалось на экране как вечная синяя полоса вдоль левой кромки, не
 * исчезающая при прокрутке. Причина оказалась двойной: (1) общий
 * `:focus-visible` в `base.css` не делал исключения для `tabindex="-1"`, и
 * (2) более специфичный `main:focus` в `Base.astro` рисовал СВОЮ метку по
 * ЛЕВОЙ кромке (`box-shadow: inset 3px 0 0 0`) — сдвиг по X на коробке
 * высотой в документ виден при любой прокрутке ровно так же, как круговой
 * outline. Проверка ниже ловит оба слоя дефекта на самой длинной странице
 * набора: полного кольца быть не должно, а если метка есть — она обязана
 * сидеть на ВЕРХНЕЙ кромке (сдвиг по Y), а не на боковой. */
test.describe('фокус на служебном tabindex="-1" контейнере не даёт полосы во всю высоту документа', () => {
  test('программный фокус на #main: без кольца периметром и без метки по боковой кромке', async ({ page }) => {
    await page.goto('/');

    const before = await page.evaluate(() => {
      const el = document.getElementById('main');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { height: rect.height };
    });
    expect(before, 'на странице нет #main — сторож ослеп').not.toBeNull();
    // Смысл проверки — именно на ВЫСОКОМ контейнере: без этого условия тест
    // прошёл бы и на короткой странице, ничего не поймав (ловушка 8,
    // `50-code/CLAUDE.md`: полоса параметров, а не точка).
    expect(before!.height, 'главная короче ожидаемого — тест перестал воспроизводить условие бага').toBeGreaterThan(2000);

    await page.evaluate(() => document.getElementById('main')?.focus());

    const after = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el.id !== 'main') return null;
      const cs = getComputedStyle(el);
      return { outlineStyle: cs.outlineStyle, boxShadow: cs.boxShadow };
    });
    expect(after, 'программный .focus() не перевёл фокус на #main').not.toBeNull();
    expect(after!.outlineStyle, '#main не должен получать кольцо-outline периметром').toBe('none');

    if (after!.boxShadow && after!.boxShadow !== 'none') {
      // Разбираем `<color> <offsetX>px <offsetY>px ...` — offsetX обязан быть
      // нулевым: ненулевой offsetX на боковой кромке коробки высотой в
      // документ и есть механизм регресса 2026-08-31.
      const match = after!.boxShadow.match(/(-?[\d.]+)px\s+(-?[\d.]+)px/);
      expect(match, `box-shadow #main не разобрать: ${after!.boxShadow}`).toBeTruthy();
      const offsetX = Number(match![1]);
      expect(
        offsetX,
        `box-shadow #main несёт горизонтальный сдвиг ${offsetX}px — на документе высотой ` +
          `${before!.height}px это боковая полоса, видимая при любой прокрутке (регресс 2026-08-31)`,
      ).toBe(0);
    }
  });
});

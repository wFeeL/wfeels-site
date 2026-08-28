import { test, expect } from '@playwright/test';

/** Сторож высоты подвала — спека `09-footer-brief.md`, раздел 11. Заменяет
 *  снятый `footer.spec.ts:158` («пустое поле справа от последней колонки»):
 *  тот сторож проверял сетку `.groups`/`.bottom` (три колонки во всю
 *  ширину), которую вариант Ф-Б снял целиком, сравнивать там больше нечего.
 *  Место этой проверки в жизни подвала то же — «подвал не разбух настолько,
 *  что перестал быть подвалом и стал полноэкранной стеной».
 *
 *  Потолок = цель + ~7%, чтобы перенос строки под другим начертанием не
 *  ронял приёмку, а лишний блок содержимого — ронял (раздел 11 брифа).
 *  Ширины и страницы — не любые под руку, а КОНКРЕТНЫЕ точки таблицы брифа:
 *  на `/` полосы действия нет никогда (`FOOTER_CTA_HIDDEN_EXACT`, `nav.ts`),
 *  на `/cases` она есть всегда — обе разновидности подвала проверяются
 *  каждая своим потолком. `/404` здесь НЕ используется намеренно: правка
 *  2026-08-26 (`13-short-pages-brief.md`, раздел 3.1 брифа `09-footer-
 *  brief.md`, D-129) сняла с неё полосу вторым признаком (`nofollow`) —
 *  сегодня она разновидность «полосы нет», а не «полосы есть», и своего
 *  теста для неё эта таблица не заводит, ту же ветку `showFooterCta`
 *  проверяет `/`.
 *
 *  Мерится в Chromium (проект по умолчанию), `deviceScaleFactor: 1`, на
 *  ПОСТРОЕННОМ `dist` (`npm run build` перед `npm run test:e2e` —
 *  README, ловушка 22 `50-code/CLAUDE.md`), в ОБЕИХ темах: высота подвала
 *  не зависит от темы (тема красит, не переставляет коробки) и не должна
 *  начать зависеть — расхождение между темами само по себе было бы
 *  дефектом, а не только превышение потолка. */

const THEMES = ['light', 'dark'] as const;

interface Ceiling {
  width: number;
  height: number;
  path: string;
  polosa: boolean;
  ceiling: number;
}

/* Раздел 11 брифа, таблица потолков высоты подвала. `path` выбран так,
 * чтобы дать нужное значение `polosa` для своей ширины — `/` никогда не
 * несёт полосу, `/cases` несёт её всегда (та же пара уже используется в
 * `footer.spec.ts`, «зазор между реквизитами…»). Строка 1180×900 в брифе
 * несёт прочерк в столбце «полоса есть» («на `/` полосы нет») — при этой
 * ширине проверяется только разновидность без полосы. */
/* Потолок первой строки поднят с 850 до 925 решением З-5 (раздел 15.5 брифа,
 * таблица раздела 11.1, та же строка «Полоса есть, 390 × 844»): подпись,
 * ставшая своей строкой ниже 900 px, добавляет +23,5 px (16,5 → 24 подпись,
 * 8 → 24 отбивка) — измерено 862,7 px, сама цифра из раздела 15.5 названа
 * заранее.
 *
 * Четыре строки «без полосы» переведены на потолок раздела 11.1 решением
 * З-4 (раздел 15.4 брифа): перестройка `.meta-top`/`.meta-aside` меняет
 * фактическую высоту на всех четырёх ширинах, и старые местные потолки либо
 * красят прогон, либо перестают отражать цену перестройки:
 * — 1180/1440 без полосы: измерено 289,0 (было 389,0) — потолок раздела 11.1
 *   ≤ 310 взят прямо, старый локальный 400 не отражал бы дельту З-4 (раздел
 *   15.4: «−100 px на 1180 и 1440»);
 * — 390 без полосы: измерено 657,0 — совпадает с формулой раздела 4.4
 *   день-в-день, но красит прежний локальный потолок 655 (превышение 2 px);
 *   потолок раздела 11.1 ≤ 690 берётся без правки числа;
 * — 768 без полосы: измерено 561,0 — выше ОБОИХ чисел брифа (раздел 4.4 ≈537,
 *   раздел 11.1 ≈525) на 24/36 px: `.meta-aside{max-width:30ch}` (то самое
 *   число решения З-4) сужает `.reply` раньше, чем предполагала таблица
 *   раздела 4.0 (которая мерила перенос строки при контейнере 65ch, до
 *   появления 30ch-ячейки), и на 768 `.reply` уже двухстрочный (48 px), а не
 *   однострочный (24 px) — третье расхождение с числами брифа, не то же
 *   самое, что уже названная разница в 12 px между 4.4 и 11.1. 561 всё ещё
 *   ниже потолка раздела 11.1 (≤ 565, запас 4 px) — он взят без правки. */
const CEILINGS: Ceiling[] = [
  { width: 390, height: 844, path: '/cases', polosa: true, ceiling: 925 },
  { width: 390, height: 844, path: '/', polosa: false, ceiling: 690 },
  { width: 768, height: 1024, path: '/cases', polosa: true, ceiling: 655 },
  { width: 768, height: 1024, path: '/', polosa: false, ceiling: 565 },
  { width: 1180, height: 900, path: '/', polosa: false, ceiling: 310 },
  { width: 1440, height: 900, path: '/cases', polosa: true, ceiling: 455 },
  { width: 1440, height: 900, path: '/', polosa: false, ceiling: 310 },
];

for (const scheme of THEMES) {
  test.describe(`подвал: потолок высоты, тема ${scheme === 'light' ? 'светлая' : 'тёмная'}`, () => {
    for (const c of CEILINGS) {
      test(`${c.width}×${c.height}, ${c.path}, полоса ${c.polosa ? 'есть' : 'нет'} — footer ≤ ${c.ceiling}px`,
        async ({ browser }) => {
          const ctx = await browser.newContext({
            viewport: { width: c.width, height: c.height },
            deviceScaleFactor: 1,
            colorScheme: scheme,
          });
          const page = await ctx.newPage();
          await page.goto(c.path);

          const box = await page.locator('footer').boundingBox();
          expect(box, `footer не найден на ${c.path}`).not.toBeNull();
          expect(
            box!.height,
            `подвал ${c.path} @ ${c.width}×${c.height} (${scheme}) = ${box!.height.toFixed(1)}px, потолок ${c.ceiling}px`,
          ).toBeLessThanOrEqual(c.ceiling);

          await ctx.close();
        });
    }
  });
}

/** Доля подвала в документе на коротких страницах — раздел 11 брифа.
 *  Знаменатель — `document.documentElement.scrollHeight`, НЕ «содержимое
 *  плюс подвал»: `base.css` даёт `body { min-height: 100dvh }` и
 *  `main { flex: 1 0 auto }`, и на короткой странице документ упирается в
 *  высоту окна, а не в сумму содержимого. `/thanks` и `/404` теперь ОБА не
 *  несут полосу (правка 2026-08-26/28, второй признак `showFooterCta`,
 *  D-129) — строки `polosa: true` ниже описывают состояние ДО этой правки
 *  и остаются как верхняя граница с запасом, не как точное ожидание;
 *  раздел 4.10 брифа `13-short-pages-brief.md`, критерий 8, проверяет
 *  точное число (≤ 34% на 1440×900) отдельным сторожем
 *  (`short-pages.spec.ts`). */
interface ShareCeiling {
  width: number;
  height: number;
  path: string;
  polosa: boolean;
  ceilingPct: number;
}

const SHARE_CEILINGS: ShareCeiling[] = [
  { width: 1440, height: 900, path: '/thanks', polosa: false, ceilingPct: 45 },
  { width: 1440, height: 900, path: '/404', polosa: false, ceilingPct: 50 },
  { width: 390, height: 844, path: '/thanks', polosa: false, ceilingPct: 63 },
  { width: 390, height: 844, path: '/404', polosa: false, ceilingPct: 65 },
];

for (const scheme of THEMES) {
  test.describe(`подвал: доля в документе, тема ${scheme === 'light' ? 'светлая' : 'тёмная'}`, () => {
    for (const c of SHARE_CEILINGS) {
      test(`${c.path} @ ${c.width}×${c.height}, полоса ${c.polosa ? 'есть' : 'нет'} — доля ≤ ${c.ceilingPct}%`,
        async ({ browser }) => {
          const ctx = await browser.newContext({
            viewport: { width: c.width, height: c.height },
            deviceScaleFactor: 1,
            colorScheme: scheme,
          });
          const page = await ctx.newPage();
          await page.goto(c.path);

          const footerHeight = await page.locator('footer').evaluate((el) => el.getBoundingClientRect().height);
          const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
          const share = (footerHeight / docHeight) * 100;

          expect(
            share,
            `${c.path} @ ${c.width}×${c.height} (${scheme}): footer=${footerHeight.toFixed(1)}px, document=${docHeight}px, доля=${share.toFixed(1)}%, потолок ${c.ceilingPct}%`,
          ).toBeLessThanOrEqual(c.ceilingPct);

          await ctx.close();
        });
    }
  });
}

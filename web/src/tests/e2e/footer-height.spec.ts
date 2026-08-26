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
 *  на `/cases` и `/404` она есть всегда — обе разновидности подвала
 *  проверяются каждая своим потолком.
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
const CEILINGS: Ceiling[] = [
  { width: 390, height: 844, path: '/cases', polosa: true, ceiling: 850 },
  { width: 390, height: 844, path: '/', polosa: false, ceiling: 655 },
  { width: 768, height: 1024, path: '/cases', polosa: true, ceiling: 655 },
  { width: 768, height: 1024, path: '/', polosa: false, ceiling: 530 },
  { width: 1180, height: 900, path: '/', polosa: false, ceiling: 400 },
  { width: 1440, height: 900, path: '/cases', polosa: true, ceiling: 455 },
  { width: 1440, height: 900, path: '/', polosa: false, ceiling: 400 },
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
 *  высоту окна, а не в сумму содержимого. `/thanks` полосы не несёт
 *  никогда (`FOOTER_CTA_HIDDEN_EXACT`), `/404` несёт её всегда (не входит
 *  ни в один список исключений `showFooterCta`). */
interface ShareCeiling {
  width: number;
  height: number;
  path: string;
  polosa: boolean;
  ceilingPct: number;
}

const SHARE_CEILINGS: ShareCeiling[] = [
  { width: 1440, height: 900, path: '/thanks', polosa: false, ceilingPct: 45 },
  { width: 1440, height: 900, path: '/404', polosa: true, ceilingPct: 50 },
  { width: 390, height: 844, path: '/thanks', polosa: false, ceilingPct: 63 },
  { width: 390, height: 844, path: '/404', polosa: true, ceilingPct: 65 },
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

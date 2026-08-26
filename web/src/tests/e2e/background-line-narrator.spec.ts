import { test, expect } from '@playwright/test';

/** Линия-рассказчик — `70-workshop/specs/site-v3/11-line-narrator-brief.md`.
 *
 *  СКОП ЭТОГО ФАЙЛА — ТОЛЬКО П1 (непрерывность, уход за текст), П2 (кнопка
 *  первого экрана) и П6 (гасит на обратном пути). П3 (карточка «Корпоративный
 *  сайт»), П4 (спина шагов и цифры) и П5 (стрелка «Замера») — отдельная
 *  задача; когда она придёт, сторожа П-7…П-10б встают в этот же файл, а
 *  список в разделе 6 брифа («новых — один») закрывается целиком.
 *
 *  Общее правило приёмки (раздел 5 брифа): координаты целей тест читает
 *  САМ (`getBoundingClientRect()`), ни один абсолютный `y` документа не
 *  попадает в тест константой — раскладка ниже `cases` уже уехала один раз
 *  на 68px и уедет снова. Контекст явно заводится с `reducedMotion:
 *  'no-preference'` там, где движение и есть предмет проверки (ловушка 5,
 *  `50-code/CLAUDE.md`) — иначе headless Chromium подставляет `reduce`
 *  молча, и тест на движение проверяет неподвижный путь. */

const VIEWPORT_1440_900 = { width: 1440, height: 900 };

/** Читает пиксель экрана в документных координатах (x, y) — тот же приём,
 *  что `background-line-stitch-blend.spec.ts`: реальный скриншот страницы
 *  (важно измерить именно то, что складывает браузер при композиции слоёв,
 *  а не поведение одного элемента в изоляции), декодирование PNG средствами
 *  самого браузера (`Image` → `<canvas>` → `getImageData`) — библиотека для
 *  чтения PNG в проекте не заведена и не нужна. */
async function readPixel(
  page: import('@playwright/test').Page,
  x: number,
  y: number,
): Promise<[number, number, number]> {
  const scrollY = await page.evaluate((targetY: number) => {
    const target = Math.max(0, targetY - 200);
    window.scrollTo(0, target);
    return window.scrollY;
  }, y);
  const size = 16;
  const viewportX = x - size / 2;
  const viewportY = y - scrollY - size / 2;
  const buffer = await page.screenshot({
    clip: { x: viewportX, y: viewportY, width: size, height: size },
  });
  const base64 = buffer.toString('base64');
  return page.evaluate(async (b64: string) => {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('не удалось декодировать снимок пикселя'));
      img.src = `data:image/png;base64,${b64}`;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const patch = 4;
    const ox = Math.floor((canvas.width - patch) / 2);
    const oy = Math.floor((canvas.height - patch) / 2);
    const data = ctx.getImageData(ox, oy, patch, patch).data;
    let r = 0;
    let g = 0;
    let b = 0;
    const n = patch * patch;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
    return [r / n, g / n, b / n] as [number, number, number];
  }, base64);
}

/** Геометрия дока линии подвала — читается из `d` самого пути (первая
 *  пара чисел — `M x,y`), не из константы: подвал несёт «сход к середине»
 *  (раздел 2 брифа, строка 11), и абсолютный `x` дока — измеренная
 *  величина, а не число, которое стоит держать в тесте руками. */
async function footerDockGeometry(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const footer = document.querySelector('footer');
    const path = footer?.querySelector('.line path') as SVGPathElement | null;
    const svg = path?.closest('svg') as SVGSVGElement | null;
    if (!footer || !path || !svg) return null;
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const scaleX = vb.width > 0 ? rect.width / vb.width : 1;
    const d = path.getAttribute('d') || '';
    const nums = (d.match(/-?\d+\.?\d*/g) || []).map(Number);
    const dockXvb = nums[0];
    const dockXpx = rect.left + dockXvb * scaleX + window.scrollX;
    const footerRect = footer.getBoundingClientRect();
    const footerTop = footerRect.top + window.scrollY;
    const footerMidY = footerTop + footerRect.height / 2;
    return { dockXpx, footerTop, footerHeight: footerRect.height, footerMidY };
  });
}

test.describe('линия-рассказчик — П1: непрерывность и уход за текст (раздел 3, П1; приёмка П-1/П-2/П-14)', () => {
  for (const [themeLabel, colorScheme] of [
    ['светлая', 'light'],
    ['тёмная', 'dark'],
  ] as const) {
    test(`тема «${themeLabel}»: фон подвала прозрачный, линия видна на середине подвала (П-1)`, async ({ browser }) => {
      const ctx = await browser.newContext({
        reducedMotion: 'reduce', // состояние по умолчанию — линия видна целиком и статична (раздел 3, «Что происходит при reduce»)
        colorScheme,
        viewport: VIEWPORT_1440_900,
      });
      const page = await ctx.newPage();
      await page.goto('/');

      // П-14 (структурно): footer не несёт собственного непрозрачного фона —
      // фон переехал на footer::before (z-index -4), сам footer не заводит
      // z-index (иначе -4 разбирался бы в чужом локальном стеке, не общем).
      const footerStyle = await page.locator('footer').evaluate((el) => {
        const s = getComputedStyle(el);
        return { background: s.backgroundColor, zIndex: s.zIndex, position: s.position };
      });
      expect(footerStyle.background, 'footer несёт собственный непрозрачный фон — линия снова красится под ним').toBe('rgba(0, 0, 0, 0)');
      expect(footerStyle.zIndex, 'footer завёл z-index — собственный стековый контекст уронит линию под ::before').toBe('auto');

      const geom = await footerDockGeometry(page);
      expect(geom, 'не удалось измерить док линии подвала').not.toBeNull();
      const { dockXpx, footerMidY } = geom!;

      // Ink-цвет на доке линии против цвета в стороне от него (тот же
      // подвал, тот же y, но вне полосы штриха) — если фон подвала снова
      // красится ПОВЕРХ линии, оба цвета совпадут (плоский срез, П-1
      // «сегодня его нет» из брифа).
      const onDock = await readPixel(page, dockXpx, footerMidY);
      const offDock = await readPixel(page, dockXpx + 220, footerMidY);
      const diff = Math.max(...onDock.map((v, i) => Math.abs(v - offDock[i])));
      console.log(
        `${themeLabel}: на доке rgb(${onDock.map((v) => Math.round(v))}), в стороне ` +
        `rgb(${offDock.map((v) => Math.round(v))}), макс. разница по каналу ${diff.toFixed(1)}`,
      );
      expect(diff, 'цвет на доке линии не отличим от фона подвала в стороне — линия невидима на середине подвала').toBeGreaterThan(4);

      await ctx.close();
    });
  }

  test('на стыке contact → подвал нет горизонтального среза: плотный скан секций остаётся зелёным (KNOWN_GAP не пополнился)', async () => {
    // Геометрический скан стыков и середин секций (background-line-ink-continuity.spec.ts)
    // не тронут этой задачей и покрывает 480–899px известным разрывом
    // .mobile-cta-range (KNOWN_GAP, задокументирован там же, продуктовый
    // вопрос без решения владельца — раздел 7 п.7 нашего брифа). Здесь
    // фиксируется факт: список известных разрывов не пополнился новым —
    // при регрессии footer::before список исполнитель обязан обновить
    // руками, а не расширять тест.
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(
      new URL('./background-line-ink-continuity.spec.ts', import.meta.url),
      'utf8',
    );
    const matches = src.match(/width:\s*\d+,/g) ?? [];
    expect(matches.length, 'KNOWN_GAP пополнился новой шириной — расхождение стало ожидаемым вместо починенного').toBe(1);
  });
});

test.describe('линия-рассказчик — П2: кнопка первого экрана (раздел 3, П2; приёмка П-5, П-6, П-6б, П-6в)', () => {
  const BORDER_LIGHT = 'rgb(203, 211, 222)';
  const BORDER_DARK = 'rgb(38, 49, 68)';
  const TEXT_LIGHT = 'rgb(15, 22, 32)';
  const TEXT_DARK = 'rgb(220, 227, 238)';
  const ACCENT_LIGHT = 'rgb(47, 91, 255)';
  const ACCENT_DARK = 'rgb(91, 132, 255)';
  const ON_ACCENT_LIGHT = 'rgb(255, 255, 255)';
  const ON_ACCENT_DARK = 'rgb(14, 20, 32)';

  async function buttonColors(page: import('@playwright/test').Page) {
    return page.locator('#hero .cta .btn.primary').evaluate((el) => {
      const s = getComputedStyle(el);
      return { backgroundColor: s.backgroundColor, color: s.color };
    });
  }

  for (const [themeLabel, colorScheme, border, text, accent, onAccent] of [
    ['светлая', 'light', BORDER_LIGHT, TEXT_LIGHT, ACCENT_LIGHT, ON_ACCENT_LIGHT],
    ['тёмная', 'dark', BORDER_DARK, TEXT_DARK, ACCENT_DARK, ON_ACCENT_DARK],
  ] as const) {
    test(`тема «${themeLabel}», 1440×900: серая при scrollY=0, акцентная после прихода линии, ступенька, реверс (П-5, П-6)`, async ({ browser }) => {
      const ctx = await browser.newContext({
        reducedMotion: 'no-preference',
        colorScheme,
        viewport: VIEWPORT_1440_900,
      });
      const page = await ctx.newPage();
      await page.goto('/');
      await page.waitForTimeout(1600); // line-load героя, 1400ms + запас

      // 1) scrollY=0 — кнопка серая (П-5, П-6.1).
      const atTop = await buttonColors(page);
      expect(atTop.backgroundColor, `${themeLabel}: заливка при scrollY=0`).toBe(border);
      expect(atTop.color, `${themeLabel}: подпись при scrollY=0`).toBe(text);

      // 2) Формула брифа (раздел 5, П-6.2): scrollY = ceil(bottom + scrollY − 0.67·innerHeight) + 8.
      // bottom читается у самой кнопки, а не берётся из брифа константой.
      const bottom = await page.locator('#hero .cta .btn.primary').evaluate((el) => el.getBoundingClientRect().bottom);
      const afterScrollY = Math.ceil(bottom + 0 - 0.67 * VIEWPORT_1440_900.height) + 8;
      const beforeScrollY = Math.floor(bottom + 0 - 0.67 * VIEWPORT_1440_900.height) - 8;
      expect(beforeScrollY, 'формула брифа дала отрицательный порог "ещё серая" — раскладка ушла сильнее ожидаемого').toBeGreaterThanOrEqual(0);

      await page.evaluate((y) => window.scrollTo(0, y), beforeScrollY);
      const stillGrey = await buttonColors(page);
      expect(stillGrey.backgroundColor, `${themeLabel}: at scrollY=${beforeScrollY} кнопка обязана быть ещё серой`).toBe(border);

      await page.evaluate((y) => window.scrollTo(0, y), afterScrollY);
      const nowAccent = await buttonColors(page);
      expect(nowAccent.backgroundColor, `${themeLabel}: at scrollY=${afterScrollY} кнопка обязана стать акцентной`).toBe(accent);
      expect(nowAccent.color, `${themeLabel}: подпись после перехода`).toBe(onAccent);

      // 3) Ступенька — на 10 позициях в полосе 200…360px backgroundColor
      // принимает ровно ДВА значения (П-6.4): запрет промежуточных цветов.
      const seen = new Set<string>();
      for (let sy = 200; sy <= 360; sy += 16) {
        await page.evaluate((y) => window.scrollTo(0, y), sy);
        const c = await buttonColors(page);
        seen.add(c.backgroundColor);
      }
      expect(seen.size, `${themeLabel}: цветов заливки на полосе 200…360px: ${[...seen].join(', ')}`).toBe(2);
      expect(seen.has(border)).toBe(true);
      expect(seen.has(accent)).toBe(true);

      // 4) Одна анимация, ступенька, fill forwards (П-6.5).
      //
      // РАСХОЖДЕНИЕ С БРИФОМ (измерено, не вкус): брифом заявлено
      // `effect.getTiming().easing === 'steps(1, jump-end)'`, но Chromium
      // при ДВУХ явных стопах (0%/100%, `from`/`to`) вешает
      // `animation-timing-function` на КАЖДЫЙ кадр (`getKeyframes()[i].easing`),
      // а не на общий `effect.getTiming()` — тот остаётся `'linear'`, потому
      // что переход НАЧАЛО→КОНЕЦ и есть весь эффект, шаг живёт внутри кадра.
      // Заодно `jump-end` — термин по умолчанию, браузер отбрасывает его при
      // сериализации: и `getComputedStyle().animationTimingFunction`, и
      // `getKeyframes()[0].easing` дают `'steps(1)'`, не `'steps(1, jump-end)'`.
      // Проверяется то же самое утверждение («ступенька, не плавный переход»)
      // тем сигналом, который браузер фактически подтверждает.
      const animInfo = await page.locator('#hero .cta .btn.primary').evaluate((el) => {
        const anims = (el as HTMLElement).getAnimations();
        const s = getComputedStyle(el);
        return anims.map((a) => ({
          effectFill: a.effect?.getTiming().fill,
          computedTimingFunction: s.animationTimingFunction,
          keyframeEasings: (a.effect as KeyframeEffect | null)?.getKeyframes().map((k) => k.easing),
        }));
      });
      expect(animInfo.length, 'кнопка обязана нести ровно одну анимацию рассказа').toBe(1);
      expect(animInfo[0].effectFill).toBe('forwards');
      expect(animInfo[0].computedTimingFunction).toBe('steps(1)');
      expect(animInfo[0].keyframeEasings).toEqual(['steps(1)', 'steps(1)']);

      // 5) Реверс — вернулись на scrollY=0, кнопка снова серая (П-6.6, П6 брифа).
      await page.evaluate(() => window.scrollTo(0, 0));
      const backToTop = await buttonColors(page);
      expect(backToTop.backgroundColor, `${themeLabel}: после возврата на scrollY=0 кнопка обязана снова стать серой`).toBe(border);
      expect(backToTop.color, `${themeLabel}: подпись после возврата`).toBe(text);

      await ctx.close();
    });
  }

  // РАСХОЖДЕНИЕ С БРИФОМ (измерено, не опечатка теста): раздел 3, П2(г)
  // называет границу «окно выше 1249px» при формуле `0,67·vh ≥ 881`
  // (881 — нижняя кромка кнопки, конец диапазона). Сама формула, решённая
  // для 881, даёт vh = 881 / 0,67 ≈ 1314,9, а не 1249 (1249 — это
  // 837 / 0,67, ВЕРХНЯЯ кромка кнопки, начало диапазона, другая строка той
  // же таблицы). Прямой замер подтверждает формулу, а не число 1249: на
  // высоте 1314px кнопка ещё серая, на 1315px — уже акцентная (проверено
  // `astro preview`, окно 1440×высота, `getComputedStyle`).
  test('окно ≥1315px (граница по формуле брифа 0,67·vh ≥ 881, не 1249 — см. комментарий): кнопка акцентная уже при загрузке (раздел 3, П2(г) — законное исключение из П-5)', async ({ browser }) => {
    const heightsAndExpected: [number, string][] = [
      [1314, 'ещё-серая'],
      [1315, 'уже-акцентная'],
    ];
    for (const [height] of heightsAndExpected) {
      const ctx = await browser.newContext({
        reducedMotion: 'no-preference',
        viewport: { width: 1440, height },
      });
      const page = await ctx.newPage();
      await page.goto('/');
      await page.waitForTimeout(1600);
      const c = await buttonColors(page);
      if (height < 1315) {
        expect(c.backgroundColor, `при высоте ${height}px кнопка обязана быть ещё серой`).toBe(BORDER_LIGHT);
      } else {
        expect(c.backgroundColor, `при высоте ${height}px кнопка обязана быть уже акцентной`).toBe(ACCENT_LIGHT);
      }
      await ctx.close();
    }
  });

  test('prefers-reduced-motion: reduce — кнопка акцентная при scrollY=0, серого состояния нет ни в одном кадре (П-6в, П-13)', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: VIEWPORT_1440_900 });
    const page = await ctx.newPage();
    await page.goto('/');
    const c = await buttonColors(page);
    expect(c.backgroundColor).toBe(ACCENT_LIGHT);
    expect(c.color).toBe(ON_ACCENT_LIGHT);
    const anims = await page.locator('#hero .cta .btn.primary').evaluate((el) => (el as HTMLElement).getAnimations().length);
    expect(anims, 'при reduce кнопка не обязана нести ни одной анимации рассказа').toBe(0);
    await ctx.close();
  });

  test('ниже 900px ширины — кнопка акцентная при любом scrollY, серого состояния нет (П-6в, П-15)', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 480, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(1600);
    const atTop = await buttonColors(page);
    expect(atTop.backgroundColor).toBe(ACCENT_LIGHT);
    await page.evaluate(() => window.scrollTo(0, 260));
    const afterScroll = await buttonColors(page);
    expect(afterScroll.backgroundColor).toBe(ACCENT_LIGHT);
    await ctx.close();
  });
});

test.describe('линия-рассказчик — П6/П12: ноль JavaScript, вес не вырос (раздел 6 брифа; приёмка П-12)', () => {
  test('в собранном HTML нет ни IntersectionObserver, ни data-line-lit/-drawn/-lit меток — защёлки не завели', async ({ request }) => {
    const res = await request.get('/');
    const html = await res.text();
    expect(html).not.toContain('IntersectionObserver');
    expect(html).not.toContain('data-line-lit');
    expect(html).not.toContain('data-line-drawn');
    expect(html).not.toContain('data-lit');
  });
});

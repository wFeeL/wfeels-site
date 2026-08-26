import { test, expect } from '@playwright/test';

/** Линия-рассказчик — `70-workshop/specs/site-v3/11-line-narrator-brief.md`.
 *
 *  СКОП ЭТОГО ФАЙЛА — П1 (непрерывность, уход за текст), П2 (кнопка первого
 *  экрана), П3 (карточка «Корпоративный сайт»), П4 (спина шагов и цифры) и
 *  П6 (гасит на обратном пути). П5 (стрелка «Замера») — вне скопа этой
 *  задачи: и отвод к полю, и сама стрелка — отдельная работа (граница
 *  раздела задачи, «П5 не трогай»); её сторожа сюда не входят.
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

  /* ПРАВКА (диагноз стоимости отрисовки, `BackgroundLine.astro`; бриф
   * `11-line-narrator-brief.md`, раздел 3, П2): сама кнопка
   * (`#hero .cta .btn.primary`) больше не перекрашивается —
   * она статически серая, а ступеньку рисует накрывающий её декоративный
   * слой (`Hero.astro`, `.cta-ignite-overlay`), чей `opacity` идёт 0→1 той
   * же самой шкалой. Видимый пользователю цвет — это цвет слоя, когда его
   * `opacity` близок к 1 (ступенька мгновенная, полутонов не бывает —
   * проверка №3 ниже это и охраняет), иначе цвет самой кнопки под ним.
   * Функция читает то же самое: ЭФФЕКТИВНЫЙ видимый цвет, а не то, какой
   * конкретно элемент его несёт — весь остальной сценарий теста (приёмка
   * П-5, П-6…) написан в терминах видимого цвета кнопки и не должен знать
   * о наличии слоя. */
  async function buttonColors(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
      const btn = document.querySelector('#hero .cta .btn.primary')!;
      const overlay = document.querySelector('#hero .cta .cta-ignite-overlay');
      const overlayOpacity = overlay ? parseFloat(getComputedStyle(overlay).opacity) : 0;
      const visible = overlayOpacity > 0.5 ? overlay! : btn;
      const s = getComputedStyle(visible);
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
      // Диагноз стоимости отрисовки (`BackgroundLine.astro`, раздел о
      // некомпозитных свойствах): сама кнопка (`#hero .cta .btn.primary`)
      // больше не несёт анимации вовсе — она статически серая. Ступеньку
      // несёт накрывающий её декоративный слой (`Hero.astro`,
      // `.cta-ignite-overlay`), и именно на нём проверяется факт «ровно одна
      // анимация, ступенька, fill forwards» — у самой кнопки анимаций теперь
      // 0, и это ожидаемо, а не потеря покрытия.
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
      const animInfo = await page.locator('#hero .cta .cta-ignite-overlay').evaluate((el) => {
        const anims = (el as HTMLElement).getAnimations();
        const s = getComputedStyle(el);
        return anims.map((a) => ({
          effectFill: a.effect?.getTiming().fill,
          computedTimingFunction: s.animationTimingFunction,
          keyframeEasings: (a.effect as KeyframeEffect | null)?.getKeyframes().map((k) => k.easing),
        }));
      });
      expect(animInfo.length, 'слой-дубликат обязан нести ровно одну анимацию рассказа').toBe(1);
      expect(animInfo[0].effectFill).toBe('forwards');

      const btnAnimsCount = await page
        .locator('#hero .cta .btn.primary')
        .evaluate((el) => (el as HTMLElement).getAnimations().length);
      expect(btnAnimsCount, 'сама кнопка обязана остаться без анимации — перекраску несёт слой').toBe(0);
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

/* Правка 2026-08-27 (`70-workshop/specs/site-v3/11-line-narrator-brief.md`,
 * раздел 10.4/10.5, Р-2 «переезд траверса»): обвод карточки «Корпоративный
 * сайт» двумя полосами `.line-outline` (П3 старой редакции, приёмка П-7)
 * СНЯТ целиком — полоса `--accent` вставала поверх постоянной рамки
 * карточки и читалась как «лёгкое утолщение края», а не как отдельное
 * событие. Событие «главный блок» переехало к самой средней линии: траверс
 * `pricing` теперь физически проходит СКВОЗЬ коробку карточки — входит
 * через одну кромку, выходит через другую. Блок ниже проверяет именно это
 * (приёмка П-21) и что обводки в разметке больше нет (приёмка П-22), вместо
 * прежних трёх тестов на `scaleY` полос, которые проверяли механизм,
 * которого больше нет.
 *
 * РАСХОЖДЕНИЕ С ПРОЗОЙ БРИФА, найденное этим тестом и не «починенное»
 * подгонкой кривой: раздел 10.4 предсказывает выход через НИЖНЮЮ кромку
 * (y≈3879), а живой замер (тот же самый `d`, что приведён в брифе дословно
 * — `M59,-60 L59,100 C59,579 941,579 941,1058 L941,1218` — сверено
 * побайтово) даёт выход через ПРАВУЮ кромку на y≈3843: `viewBox`
 * растянут неравномерно (`preserveAspectRatio="none"`, `scaleX≈1,38` против
 * `scaleY≈1,18` на 1440), и кривая, задуманная как «падает на дно
 * карточки», на самом деле сначала достигает её правого края. Ядро
 * требования раздела 10.4 — «войти через одну кромку и выйти через
 * другую» — от этого не страдает: линия входит через левую кромку и
 * выходит через правую, обе точки пересечения дают угол ≥30° (Г-5), а
 * внутри карточки лежит больше 240px краски. Курс на «новой геометрии не
 * рисуется, меняется вызов» (раздел 10.4) запрещает подгонять кривую под
 * прозу брифа — сторож проверяет то, что СУЩЕСТВУЕТ и удовлетворяет
 * числовому порогу П-21, а не название кромки из чужой оценки. */
test.describe('линия-рассказчик — П21: карточка «Корпоративный сайт» пересечена линией (раздел 10.4 брифа; приёмка П-21)', () => {
  const CARD_SELECTOR = '#pricing .top-grid > .card--accent';
  const MIN_INSIDE_PX = 240;
  const MIN_ANGLE_DEG = 30;

  test('1440×900: вход и выход — через РАЗНЫЕ кромки, ≥240px внутри карточки, углы ≥30°', async ({ page }) => {
    await page.setViewportSize(VIEWPORT_1440_900);
    await page.goto('/');

    const result = await page.evaluate((cardSelector) => {
      const card = document.querySelector(cardSelector);
      const path = document.querySelector('#pricing svg.line path:not(.line-branch)') as SVGPathElement | null;
      const svg = path?.closest('svg') as SVGSVGElement | null;
      if (!card || !path || !svg) return null;

      const cardBox = card.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();
      const vb = svg.viewBox.baseVal;
      const scaleX = vb.width > 0 ? svgRect.width / vb.width : 1;
      const scaleY = vb.height > 0 ? svgRect.height / vb.height : 1;

      const total = path.getTotalLength();
      const toPagePoint = (len: number) => {
        const p = path.getPointAtLength(len);
        return { x: svgRect.left + (p.x - vb.x) * scaleX, y: svgRect.top + (p.y - vb.y) * scaleY };
      };
      const isInside = (pt: { x: number; y: number }) =>
        pt.x >= cardBox.left && pt.x <= cardBox.right && pt.y >= cardBox.top && pt.y <= cardBox.bottom;

      // Сэмплируем путь через 1 единицу длины (`viewBox`) — при 1300–1700
      // единицах общей длины и разнице масштабов ×1,2–1,4 это даёт шаг
      // ~1,2–1,4px в реальных координатах, достаточно для коробки в сотни px.
      const samples: Array<{ len: number; x: number; y: number; inside: boolean }> = [];
      for (let len = 0; len <= total; len += 1) {
        const pt = toPagePoint(len);
        samples.push({ len, ...pt, inside: isInside(pt) });
      }

      const firstIdx = samples.findIndex((s) => s.inside);
      let lastIdx = -1;
      for (let i = samples.length - 1; i >= 0; i -= 1) {
        if (samples[i].inside) { lastIdx = i; break; }
      }
      if (firstIdx === -1 || lastIdx === -1) return { insideAtAll: false as const };

      // Реальные px внутри карточки — сумма евклидовых отрезков между
      // соседними сэмплами (масштаб по X и Y разный, поэтому длина в
      // единицах `viewBox` не равна длине в реальных px — считать нужно
      // именно в РЕАЛЬНЫХ координатах, а не разницей `len`).
      let insidePx = 0;
      for (let i = firstIdx; i < lastIdx; i += 1) {
        const a = samples[i];
        const b = samples[i + 1];
        insidePx += Math.hypot(b.x - a.x, b.y - a.y);
      }

      const entry = samples[firstIdx];
      const exit = samples[lastIdx];

      const sideOf = (pt: { x: number; y: number }) => {
        const d = {
          left: Math.abs(pt.x - cardBox.left),
          right: Math.abs(pt.x - cardBox.right),
          top: Math.abs(pt.y - cardBox.top),
          bottom: Math.abs(pt.y - cardBox.bottom),
        };
        return (Object.entries(d) as Array<[string, number]>).sort((a, b) => a[1] - b[1])[0][0];
      };

      // Угол между касательной пути в точке пересечения и самой кромкой:
      // левая/правая кромка вертикальна (90° от горизонтали), верхняя/
      // нижняя — горизонтальна (0°).
      const EPS = 4;
      const tangentAngleDeg = (len: number) => {
        const a = path.getPointAtLength(Math.max(0, len - EPS));
        const b = path.getPointAtLength(Math.min(total, len + EPS));
        const dx = (b.x - a.x) * scaleX;
        const dy = (b.y - a.y) * scaleY;
        return (Math.atan2(dy, dx) * 180) / Math.PI;
      };
      const angleToEdge = (side: string, angleDeg: number) => {
        const edgeAngle = side === 'left' || side === 'right' ? 90 : 0;
        let diff = Math.abs(angleDeg - edgeAngle) % 180;
        if (diff > 90) diff = 180 - diff;
        return diff;
      };

      const entrySide = sideOf(entry);
      const exitSide = sideOf(exit);
      return {
        insideAtAll: true as const,
        insidePx,
        entrySide,
        exitSide,
        entryAngle: angleToEdge(entrySide, tangentAngleDeg(entry.len)),
        exitAngle: angleToEdge(exitSide, tangentAngleDeg(exit.len)),
      };
    }, CARD_SELECTOR);

    expect(result, 'не удалось измерить геометрию линии/карточки на странице').not.toBeNull();
    expect(result!.insideAtAll, 'краска средней линии ни разу не попала внутрь коробки карточки').toBe(true);
    if (!result!.insideAtAll) return;

    // Ядро П-21 — вход и выход через РАЗНЫЕ кромки (не «обвод по одной
    // стороне»). Конкретная пара кромок — факт живого замера (см. комментарий
    // выше блока), а не число из прозы брифа.
    expect(result!.entrySide, 'вход и выход обязаны быть через разные кромки')
      .not.toBe(result!.exitSide);
    expect(result!.entrySide, `линия обязана входить через ЛЕВУЮ кромку (вошла через ${result!.entrySide})`).toBe('left');
    expect(result!.insidePx, `внутри карточки должно быть ≥${MIN_INSIDE_PX}px (факт ${result!.insidePx.toFixed(0)}px)`)
      .toBeGreaterThanOrEqual(MIN_INSIDE_PX);
    expect(result!.entryAngle, `угол на входе должен быть ≥${MIN_ANGLE_DEG}° (факт ${result!.entryAngle.toFixed(1)}°)`)
      .toBeGreaterThanOrEqual(MIN_ANGLE_DEG);
    expect(result!.exitAngle, `угол на выходе должен быть ≥${MIN_ANGLE_DEG}° (факт ${result!.exitAngle.toFixed(1)}°)`)
      .toBeGreaterThanOrEqual(MIN_ANGLE_DEG);
  });

  test('обводки карточки больше нет — ни .line-outline в разметке, ни анимаций scaleY (приёмка П-22)', async ({ page }) => {
    await page.setViewportSize(VIEWPORT_1440_900);
    await page.goto('/');

    const outlineCount = await page.locator(`${CARD_SELECTOR} .line-outline`).count();
    expect(outlineCount, 'на карточке не должно остаться ни одного .line-outline').toBe(0);

    const animationNames = await page.locator(CARD_SELECTOR).evaluate((el) =>
      (el as Element & { getAnimations: (opts?: { subtree: boolean }) => Animation[] })
        .getAnimations({ subtree: true })
        .map((a) => (a as unknown as { animationName?: string }).animationName ?? ''),
    );
    expect(
      animationNames.some((name) => /outline/i.test(name)),
      `анимации карточки не должны включать обвод: ${animationNames.join(', ') || '(нет анимаций)'}`,
    ).toBe(false);
  });
});

test.describe('линия-рассказчик — П4: спина шагов и подчёркивания цифр 01…05 (раздел 3 П4; приёмка П-8, П-15)', () => {
  async function underlineScaleX(page: import('@playwright/test').Page, nth: number) {
    return page.locator('#process .step .num').nth(nth).evaluate((el) => {
      const m = getComputedStyle(el, '::after').transform.match(/matrix\(([^)]+)\)/);
      if (!m) return NaN;
      return parseFloat(m[1].split(',')[0]); // scaleX — первый компонент matrix
    });
  }

  test('1440×900: подчёркивания приходят по очереди — первая цифра раньше последней, а не все разом', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: VIEWPORT_1440_900 });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(1600);

    // scrollY=0 — ни одно подчёркивание не начато.
    for (let i = 0; i < 5; i++) {
      const sx = await underlineScaleX(page, i);
      expect(sx, `при scrollY=0 подчёркивание цифры №${i + 1} обязано быть на scaleX(0)`).toBeLessThan(0.02);
    }

    // Прокрутка до конца окна первой цифры (01) — она дорисована, а
    // последняя (05), стоящая заметно ниже по документу, ещё нет.
    const firstBottom = await page.locator('#process .step .num').first().evaluate((el) => el.getBoundingClientRect().bottom + window.scrollY);
    const scrollYAfterFirst = Math.ceil(firstBottom - 0.67 * VIEWPORT_1440_900.height) + 8;
    await page.evaluate((y) => window.scrollTo(0, y), scrollYAfterFirst);
    const firstScaleX = await underlineScaleX(page, 0);
    const lastScaleX = await underlineScaleX(page, 4);
    expect(firstScaleX, 'подчёркивание первой цифры обязано быть дорисовано раньше последней').toBeGreaterThan(0.9);
    expect(lastScaleX, 'подчёркивание последней цифры ещё не должно начаться, когда первая уже дорисована').toBeLessThan(0.9);

    // Реверс — вернулись на scrollY=0, подчёркивание первой цифры гаснет (П6).
    await page.evaluate(() => window.scrollTo(0, 0));
    const backToTop = await underlineScaleX(page, 0);
    expect(backToTop, 'после возврата на scrollY=0 подчёркивание обязано погаснуть').toBeLessThan(0.02);

    await ctx.close();
  });

  test('спина (.line-branch) видима от 900px и скрыта ниже (П-15)', async ({ browser }) => {
    const narrow = await browser.newContext({ viewport: { width: 480, height: 900 } });
    const narrowPage = await narrow.newPage();
    await narrowPage.goto('/');
    const narrowDisplay = await narrowPage.locator('#process .line-branch').evaluate((el) => getComputedStyle(el).display);
    expect(narrowDisplay, 'ниже 900px спина обязана быть скрыта').toBe('none');
    await narrow.close();

    const wide = await browser.newContext({ viewport: VIEWPORT_1440_900 });
    const widePage = await wide.newPage();
    await widePage.goto('/');
    const wideDisplay = await widePage.locator('#process .line-branch').evaluate((el) => getComputedStyle(el).display);
    expect(wideDisplay, 'от 900px спина обязана быть видима').not.toBe('none');
    await wide.close();
  });

  test('спина: ось на 1440 стоит на x = 151 ± 6 px (П-8)', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: VIEWPORT_1440_900 });
    const page = await ctx.newPage();
    await page.goto('/');
    const rect = await page.locator('#process .line-branch').evaluate((el) => (el as SVGPathElement).getBoundingClientRect());
    // Спина уходит от правого дока (vb x=941) влево до оси x=88 и там же
    // разворачивается вправо к x=1000 — самая левая точка всего пути и
    // есть ось x=88 из требования брифа, значит левая кромка bbox самого
    // элемента (плюс половина волосяного штриха, ей приписанная браузером)
    // прямо и есть измеряемая величина, без пересчёта viewBox→px руками.
    expect(rect.x, `левая кромка bbox спины на x=${rect.x}, ожидалось 151±6`).toBeGreaterThanOrEqual(145);
    expect(rect.x, `левая кромка bbox спины на x=${rect.x}, ожидалось 151±6`).toBeLessThanOrEqual(157);
    await ctx.close();
  });
});

import { test, expect } from '@playwright/test';

/** Линия-рассказчик — `70-workshop/specs/site-v3/11-line-narrator-brief.md`,
 *  дополнено `70-workshop/specs/site-v3/16-line-digits-and-finale-brief.md`.
 *
 *  СКОП ЭТОГО ФАЙЛА — П1 (непрерывность, уход за текст), П2 (кнопка первого
 *  экрана), П3 (карточка «Корпоративный сайт»), зажигание цифр процесса
 *  (раздел 2 брифа `16-…`, приёмка П-Ц1…П-Ц7 — заменяет собой прежний блок
 *  «П4: спина шагов и подчёркивания цифр», предмет которого — пять отводов
 *  `LINE_PATHS.process.branch` — снят решением владельца `2026-08-27`) и П6
 *  (гасит на обратном пути). П5 (стрелка «Замера») — вне скопа этой задачи:
 *  и отвод к полю, и сама стрелка — отдельная работа (граница раздела
 *  задачи, «П5 не трогай»); её сторожа сюда не входят.
 *
 *  Общее правило приёмки (раздел 5 брифа): координаты целей тест читает
 *  САМ (`getBoundingClientRect()`), ни один абсолютный `y` документа не
 *  попадает в тест константой — раскладка ниже `cases` уже уехала один раз
 *  на 68px и уедет снова. Контекст явно заводится с `reducedMotion:
 *  'no-preference'` там, где движение и есть предмет проверки (ловушка 5,
 *  `50-code/CLAUDE.md`) — иначе headless Chromium подставляет `reduce`
 *  молча, и тест на движение проверяет неподвижный путь. */

const VIEWPORT_1440_900 = { width: 1440, height: 900 };

/** Читает `--line-head` в px на живой странице (`70-workshop/specs/site-v3/
 *  15-line-through-scale-brief.md`, раздел 2.5/4.1) — заменяет прежнюю
 *  константу `0.67 * vh` (`cover calc(100% - var(--line-trail))`,
 *  `--line-trail: 67vh`) всюду, где пороги считались от неё. Приём —
 *  `position: fixed` зонд с `top: var(--line-head)`: браузер сам резолвит
 *  формулу `max(80vh, calc(100vh - 347px))` в пиксели, второй копии
 *  формулы в тесте не заводится. */
async function readLineHeadPx(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.position = 'fixed';
    probe.style.visibility = 'hidden';
    probe.style.top = 'var(--line-head)';
    document.body.appendChild(probe);
    const head = probe.getBoundingClientRect().top;
    probe.remove();
    return head;
  });
}

/** Декодирует PNG-снимок средствами самого браузера (`Image` → `<canvas>` →
 *  `getImageData`, усреднение центрального пятна 4×4) — библиотека для
 *  чтения PNG в проекте не заведена и не нужна. Общий хвост для `readPixel`
 *  (сам скроллит к цели) и `readPixelAtViewport` (не скроллит — состояние
 *  прокрутки уже задано вызывающим кодом и менять его самовольно нельзя,
 *  раздел 10.6: цвет ступени лестницы ЗАВИСИТ от scrollY). */
async function decodeClipAverage(
  page: import('@playwright/test').Page,
  buffer: Buffer,
): Promise<[number, number, number]> {
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

/** Читает пиксель по ВЬЮПОРТНЫМ координатам, БЕЗ скролла (раздел 10.6,
 *  Р-3): лестница зажигания кнопки меняет видимый цвет в зависимости от
 *  ТЕКУЩЕГО scrollY — `readPixel` сдвинул бы страницу под свой удобный кадр
 *  и тем самым сменил бы проверяемое состояние. Вызывающий код обязан сам
 *  прокрутить страницу до нужного scrollY и передать уже актуальные
 *  вьюпортные координаты (`getBoundingClientRect()` после скролла). */
async function readPixelAtViewport(
  page: import('@playwright/test').Page,
  viewportX: number,
  viewportY: number,
): Promise<[number, number, number]> {
  const size = 16;
  const buffer = await page.screenshot({
    clip: { x: viewportX - size / 2, y: viewportY - size / 2, width: size, height: size },
  });
  return decodeClipAverage(page, buffer);
}

/** РЕШЕНИЕ В-4 (раздел 12.1 брифа `11-line-narrator-brief.md`, таблица
 *  12.5 — «подвал линии не несёт вовсе») ОТМЕНЕНО вариантом Б финала
 *  (`70-workshop/specs/site-v3/16-line-digits-and-finale-brief.md`, раздел
 *  3.3, выбран владельцем `2026-08-27`): уход `contact` переехал в подвал
 *  тем же жестом (`footer.wide`), и `Footer.astro` теперь намеренно рисует
 *  `.line`/`.line-curtain-local` — запись `LINE_PATHS.footer` вернулась в
 *  реестр. Канонический сторож этого узла (порядок слоёв, отсутствие
 *  акцента — П-Ф-Б5/Б6) — `background-line-footer-reach.spec.ts`; функция
 *  ниже проверяет только структурный факт, обратный тому, что проверялся
 *  до правки: узлы линии под `<footer>` ОБЯЗАНЫ быть в разметке. */
async function footerHasLine(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => {
    const footer = document.querySelector('footer');
    if (!footer) return false;
    return footer.querySelector('.line') !== null && footer.querySelector('.line-curtain-local') !== null;
  });
}

test.describe('линия-рассказчик — П1: непрерывность и уход за текст (раздел 3, П1; приёмка П-1/П-2/П-14)', () => {
  for (const [themeLabel, colorScheme] of [
    ['светлая', 'light'],
    ['тёмная', 'dark'],
  ] as const) {
    test(`тема «${themeLabel}»: фон подвала прозрачный, линия в подвале есть (П-1, В-4 отменена вариантом Б)`, async ({ browser }) => {
      const ctx = await browser.newContext({
        reducedMotion: 'reduce', // состояние по умолчанию — линия видна целиком и статична (раздел 3, «Что происходит при reduce»)
        colorScheme,
        viewport: VIEWPORT_1440_900,
      });
      const page = await ctx.newPage();
      await page.goto('/');

      // П-14 (структурно): footer не несёт собственного непрозрачного фона —
      // фон переехал на footer::before (z-index -2, раздел 2.4 брифа
      // `15-line-through-scale-brief.md`, правка `2026-08-27` — было -4),
      // сам footer не заводит z-index (иначе -2 разбирался бы в чужом
      // локальном стеке, не общем). Числовое значение z-index проверяет
      // `background-line-footer-reach.spec.ts` (П-Ф3); здесь — структурный
      // инвариант «footer сам не несёт z-index».
      const footerStyle = await page.locator('footer').evaluate((el) => {
        const s = getComputedStyle(el);
        return { background: s.backgroundColor, zIndex: s.zIndex, position: s.position };
      });
      expect(footerStyle.background, 'footer несёт собственный непрозрачный фон — линия снова красится под ним').toBe('rgba(0, 0, 0, 0)');
      expect(footerStyle.zIndex, 'footer завёл z-index — собственный стековый контекст уронит линию под ::before').toBe('auto');

      // В-4 ОТМЕНЕНА вариантом Б (см. JSDoc `footerHasLine` выше): подвал
      // ТЕПЕРЬ структурно несёт линию — уход `contact` переехал сюда тем же
      // жестом. Было: тест требовал полного отсутствия узлов линии в
      // подвале (`footerHasNoLine`, `toBe(true)` на «нет линии»). Стало:
      // подвал обязан нести оба узла — `.line` и местную шторку
      // `.line-curtain-local` (порядок слоёв и отсутствие акцента в её
      // покраске проверяет отдельно `background-line-footer-reach.spec.ts`,
      // П-Ф-Б5/Б6, — здесь только структурный факт присутствия).
      const hasLine = await footerHasLine(page);
      expect(hasLine, 'в подвале нет .line/.line-curtain-local — вариант Б финала требует, чтобы линия доходила до подвала').toBe(true);

      await ctx.close();
    });
  }

  test('сторож протяжённости линии (background-line-ink-continuity.spec.ts) не заводит скрытых исключений', async () => {
    // ПРАВКА `2026-08-27` (`70-workshop/specs/site-v3/
    // 15-line-through-scale-brief.md`): сторож переписан целиком под
    // сквозную шкалу и сканирует ширины ≥900px (раздел 2.5 брифа/П-Э1…П-Э4);
    // известный зазор `.mobile-cta-range` между `faq`/`contact` на
    // 480…899px — раздел 6.4 брифа: «остаётся и меняет природу», решение
    // владельца не получено, вопрос вынесен отдельно (раздел 9 брифа), в
    // разметку/скан этого файла не входит. Проверка здесь — что новый
    // сторож не завёл СВОЙ список исключений (`KNOWN_GAP` или аналог) молча:
    // если такой список появится, это будет означать новый необъявленный
    // разрыв, а не восстановленный.
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(
      new URL('./background-line-ink-continuity.spec.ts', import.meta.url),
      'utf8',
    );
    expect(src, 'сторож протяжённости завёл список исключений — разрыв не задокументирован явно в брифе').not.toMatch(/KNOWN_GAP/);
  });
});

test.describe('линия-рассказчик — П2: кнопка первого экрана — лестница (раздел 3, П2; раздел 10.6, Р-3; приёмка П-5, П-6, П-6б, П-6в)', () => {
  const BORDER_LIGHT = 'rgb(203, 211, 222)';
  const BORDER_DARK = 'rgb(38, 49, 68)';
  const TEXT_LIGHT = 'rgb(15, 22, 32)';
  const TEXT_DARK = 'rgb(220, 227, 238)';
  const ACCENT_LIGHT = 'rgb(47, 91, 255)';
  const ACCENT_DARK = 'rgb(91, 132, 255)';
  const ON_ACCENT_LIGHT = 'rgb(255, 255, 255)';
  const ON_ACCENT_DARK = 'rgb(14, 20, 32)';
  const N_STEPS = 5;
  const STEP_PX = 8.8; // высота кнопки (44px) / N (5) — раздел 10.6, Р-3.

  /* ЛЕСТНИЦА (раздел 10.6, Р-3, `2026-08-27`): один слой-дубликат заменён
   * на пять вложенных по ширине слоёв (`Hero.astro`, `.cta-ignite-step`,
   * `data-step="1..5"`), каждый — своя ступенька `opacity` со своим
   * порогом. Топ стека — слой с наибольшим `data-step` (он же самый
   * широкий и стоит последним в DOM, поэтому painting-порядком выше
   * остальных): если он непрозрачен, он один накрывает кнопку целиком, и
   * «эффективный» видимый цвет — его. Если непрозрачных слоёв нет вовсе —
   * виден сам `.btn.primary`. Эта функция воспроизводит только ДВА
   * полностью однородных состояния (полностью серое / полностью
   * акцентное) — то же, что видел прежний тест с единственным слоем;
   * ЧАСТИЧНОЕ заполнение (одни ступени уже акцентные, другие ещё нет)
   * отдельно проверяется ниже сэмплированием пикселя по x. */
  async function buttonColors(page: import('@playwright/test').Page) {
    return page.evaluate((nSteps: number) => {
      const btn = document.querySelector('#hero .cta .btn.primary')!;
      let visible: Element = btn;
      for (let step = nSteps; step >= 1; step -= 1) {
        const layer = document.querySelector(`#hero .cta .cta-ignite-step[data-step="${step}"]`);
        if (layer && parseFloat(getComputedStyle(layer).opacity) > 0.5) {
          visible = layer;
          break;
        }
      }
      const s = getComputedStyle(visible);
      return { backgroundColor: s.backgroundColor, color: s.color };
    }, N_STEPS);
  }

  /** Сканирует scrollY от `fromY` до `toY` (шаг 1px) и возвращает первый
   *  scrollY, на котором `opacity` слоя `data-step="step"` переходит выше
   *  0,5, или -1, если порог не найден в диапазоне.
   *
   *  ДВА ОТДЕЛЬНЫХ `page.evaluate()` НА КАЖДЫЙ `y` — `scrollTo`, ЗАТЕМ
   *  (второй самостоятельный round-trip) чтение `opacity`. Было опробовано
   *  и отброшено ДВАЖДЫ: (1) цикл `scrollTo` внутри ОДНОГО `evaluate` —
   *  все пять слоёв «нашли» один и тот же порог (`Received: 1` вместо
   *  `5`); (2) `scrollTo` и чтение в ОДНОМ `evaluate`, но по отдельному
   *  вызову на каждый `y`, — снова один и тот же порог для всех пяти
   *  слоёв, ОТЛИЧНЫЙ от предыдущего замера тем же кодом на тех же
   *  координатах (`stillGrey`/`nowAccent` выше в этом же тесте, где
   *  `scrollTo` и чтение стиля — уже ДВЕ раздельные команды). Прогресс
   *  `animation-timeline: view()` пересчитывается браузером на шаге
   *  рендеринга между двумя ПОСТУПИВШИМИ от клиента командами, а не
   *  синхронно внутри одной JS-функции, которой они переданы разом одним
   *  вызовом `evaluate` — сама функция целиком выполняется как один
   *  JS-таск, кадра рендеринга между её собственными строками нет, сколько
   *  бы отдельных вызовов `evaluate()` ни делал внешний код. Родство с
   *  ловушками 6/7 (`50-code/CLAUDE.md`): scroll-driven CSS не измеряется
   *  синхронным JS без реального кадра между `scrollTo` и чтением. */
  async function findStepThreshold(
    page: import('@playwright/test').Page,
    step: number,
    fromY: number,
    toY: number,
  ): Promise<number> {
    for (let y = fromY; y <= toY; y += 1) {
      await page.evaluate((yy: number) => window.scrollTo(0, yy), y);
      const op = await page.evaluate((s: number) => {
        const layer = document.querySelector(`#hero .cta .cta-ignite-step[data-step="${s}"]`);
        return layer ? parseFloat(getComputedStyle(layer).opacity) : NaN;
      }, step);
      if (op > 0.5) return y;
    }
    return -1;
  }

  for (const [themeLabel, colorScheme, border, text, accent, onAccent] of [
    ['светлая', 'light', BORDER_LIGHT, TEXT_LIGHT, ACCENT_LIGHT, ON_ACCENT_LIGHT],
    ['тёмная', 'dark', BORDER_DARK, TEXT_DARK, ACCENT_DARK, ON_ACCENT_DARK],
  ] as const) {
    test(`тема «${themeLabel}», 1440×900: серая при scrollY=0, акцентная после прихода линии, пять порогов лестницы, реверс (П-5, П-6, Р-3)`, async ({ browser }) => {
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

      // 2) Формула брифа (раздел 5, П-6.2): порог ПЯТОГО слоя (i=5, сдвиг 0)
      // — тот же самый, что нёс единственный слой до лестницы. bottom
      // читается у самой кнопки, а не берётся из брифа константой.
      // `beforeAllScrollY` отодвинут ЕЩЁ РАНЬШЕ на весь разбег лестницы
      // (4 интервала по 8,8px) плюс запас — на нём ни один из пяти порогов
      // не должен быть пройден.
      const bottom = await page.locator('#hero .cta .btn.primary').evaluate((el) => el.getBoundingClientRect().bottom);
      // Раздел 4.2 брифа `15-line-through-scale-brief.md`: механическая
      // замена `0.67 · vh` (было — `cover calc(100% - var(--line-trail))`)
      // на `--line-head` (стало — `cover calc(100% - var(--line-head))`),
      // читаемый живьём, а не второй копией формулы `max(80vh, 100vh-347)`.
      const lineHead = await readLineHeadPx(page);
      const afterScrollY = Math.ceil(bottom - lineHead) + 8;
      const beforeAllScrollY = Math.max(
        0,
        Math.floor(bottom - lineHead) - 8 - Math.ceil((N_STEPS - 1) * STEP_PX) - 8,
      );

      await page.evaluate((y) => window.scrollTo(0, y), beforeAllScrollY);
      const stillGrey = await buttonColors(page);
      expect(stillGrey.backgroundColor, `${themeLabel}: at scrollY=${beforeAllScrollY} кнопка обязана быть ещё серой (ни один порог лестницы не пройден)`).toBe(border);

      await page.evaluate((y) => window.scrollTo(0, y), afterScrollY);
      const nowAccent = await buttonColors(page);
      expect(nowAccent.backgroundColor, `${themeLabel}: at scrollY=${afterScrollY} кнопка обязана стать полностью акцентной`).toBe(accent);
      expect(nowAccent.color, `${themeLabel}: подпись после перехода`).toBe(onAccent);

      // 3) Пять РАЗНЫХ порогов, интервал ≈8,8px (раздел 10.6, Р-3) — сканируем
      // opacity каждого из пяти слоёв отдельно (без снимков экрана, дёшево)
      // в диапазоне от beforeAllScrollY до afterScrollY+2.
      const thresholds: number[] = [];
      for (let step = 1; step <= N_STEPS; step += 1) {
        const found = await findStepThreshold(page, step, beforeAllScrollY, afterScrollY + 2);
        expect(found, `${themeLabel}: порог слоя data-step="${step}" не найден в скане ${beforeAllScrollY}…${afterScrollY + 2}`).toBeGreaterThan(-1);
        thresholds.push(found);
      }
      // eslint-disable-next-line no-console
      console.log(`${themeLabel}: пять порогов лестницы (scrollY) = [${thresholds.join(', ')}], последний = ${afterScrollY}`);
      expect(new Set(thresholds).size, 'пять порогов обязаны быть РАЗНЫМИ scrollY, не одним общим').toBe(N_STEPS);
      for (let i = 1; i < thresholds.length; i += 1) {
        const gap = thresholds[i] - thresholds[i - 1];
        expect(gap, `${themeLabel}: интервал между порогом ${i} и ${i + 1} обязан быть ≈8,8px, факт ${gap}px`).toBeGreaterThanOrEqual(6);
        expect(gap, `${themeLabel}: интервал между порогом ${i} и ${i + 1} обязан быть ≈8,8px, факт ${gap}px`).toBeLessThanOrEqual(12);
      }

      // 4) Заливка растёт слева направо, без смеси цвета (раздел 10.6):
      // на пороге среднего слоя (`data-step="3"`) полоса 3 из пяти (уже
      // открытая) обязана быть акцентной, а полоса 4 (ещё не открытая) —
      // остаться прежней. Координаты полос читаются из живой геометрии
      // кнопки, не из констант.
      const btnBox = await page.locator('#hero .cta .btn.primary').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, width: r.width, top: r.top, height: r.height };
      });
      const bandCenterX = (bandIndex1to5: number) => btnBox.left + ((bandIndex1to5 - 0.5) / N_STEPS) * btnBox.width;
      const midThreshold = thresholds[2]; // порог слоя data-step="3"
      await page.evaluate((y) => window.scrollTo(0, y), midThreshold);
      // Y-координата у кнопки не меняется с прокруткой по вертикали окна
      // (кнопка не двигается сама по себе) — берём её заново под текущим
      // scrollY, а не переиспользуем btnBox.top, снятый на другом scrollY.
      const btnTopNow = await page.locator('#hero .cta .btn.primary').evaluate((el) => el.getBoundingClientRect().top);
      // НЕ вертикальный центр (`btnBox.height / 2`) — там стоит подпись
      // кнопки (`Button.astro`: `padding: 10px 20px`, текст между
      // паддингами), и первая редакция этого замера споткнулась именно об
      // это: пиксель на пороге читался как «смесь» (rgb(137,162,255) при
      // ожидаемом чистом акценте) — не смесь заливки, а сглаживание края
      // ГЛИФА текста поверх плоского фона. `--radius-pill` кнопки закруглён
      // только у левого/правого торца (радиус = половина высоты), а
      // `bandCenterX(3)`/`bandCenterX(4)` стоят у середины ширины — там
      // верхняя кромка на 6px от края уже плоская (не скруглённая) и без
      // текста (текст начинается заметно ниже верхнего паддинга).
      const bandY = btnTopNow + 6;
      const litBand = await readPixelAtViewport(page, bandCenterX(3), bandY);
      const unlitBand = await readPixelAtViewport(page, bandCenterX(4), bandY);
      const accentRgb = accent.match(/\d+/g)!.map(Number);
      const borderRgb = border.match(/\d+/g)!.map(Number);
      const closeTo = (px: number[], target: number[]) => target.every((v, idx) => Math.abs(px[idx] - v) <= 16);
      expect(closeTo(litBand, accentRgb), `${themeLabel}: полоса 3 на её собственном пороге обязана быть акцентной, факт rgb(${litBand.map((v) => Math.round(v))})`).toBe(true);
      expect(closeTo(unlitBand, borderRgb), `${themeLabel}: полоса 4, ещё не открытая на этом пороге, обязана остаться серой (без смеси цвета), факт rgb(${unlitBand.map((v) => Math.round(v))})`).toBe(true);

      // 5) Каждый слой несёт ровно одну ступеньку (steps(1,jump-end)), fill:
      // forwards — та же проверка, что раньше делалась на единственном
      // слое, теперь на всех пяти.
      //
      // РАСХОЖДЕНИЕ С БРИФОМ (измерено, не вкус, унаследовано от прежнего
      // одноступенчатого слоя): брифом заявлено
      // `effect.getTiming().easing === 'steps(1, jump-end)'`, но Chromium
      // при двух явных стопах (0%/100%, from/to) вешает
      // `animation-timing-function` на КАЖДЫЙ кадр (`getKeyframes()[i].easing`),
      // а не на общий `effect.getTiming()` — тот остаётся `'linear'`.
      // `jump-end` — термин по умолчанию, браузер отбрасывает его при
      // сериализации: и `getComputedStyle().animationTimingFunction`, и
      // `getKeyframes()[0].easing` дают `'steps(1)'`.
      const animInfos = await page.evaluate((nSteps: number) => {
        const out: Array<{ effectFill?: string; computedTimingFunction: string; keyframeEasings?: (string | undefined)[]; animCount: number }> = [];
        for (let step = 1; step <= nSteps; step += 1) {
          const el = document.querySelector(`#hero .cta .cta-ignite-step[data-step="${step}"]`) as HTMLElement;
          const anims = el.getAnimations();
          const s = getComputedStyle(el);
          out.push({
            animCount: anims.length,
            effectFill: anims[0]?.effect?.getTiming().fill as string | undefined,
            computedTimingFunction: s.animationTimingFunction,
            keyframeEasings: (anims[0]?.effect as KeyframeEffect | null)?.getKeyframes().map((k) => k.easing as string),
          });
        }
        return out;
      }, N_STEPS);
      for (const [i, info] of animInfos.entries()) {
        expect(info.animCount, `слой data-step="${i + 1}" обязан нести ровно одну анимацию рассказа`).toBe(1);
        expect(info.effectFill, `слой data-step="${i + 1}" обязан нести fill:forwards`).toBe('forwards');
        expect(info.computedTimingFunction, `слой data-step="${i + 1}" обязан быть ступенькой`).toBe('steps(1)');
        expect(info.keyframeEasings, `слой data-step="${i + 1}": кадры обязаны быть ступенькой`).toEqual(['steps(1)', 'steps(1)']);
      }

      const btnAnimsCount = await page
        .locator('#hero .cta .btn.primary')
        .evaluate((el) => (el as HTMLElement).getAnimations().length);
      expect(btnAnimsCount, 'сама кнопка обязана остаться без анимации — перекраску несут слои лестницы').toBe(0);

      // 6) Реверс — вернулись на scrollY=0, кнопка снова серая (П-6.6, П6 брифа).
      await page.evaluate(() => window.scrollTo(0, 0));
      const backToTop = await buttonColors(page);
      expect(backToTop.backgroundColor, `${themeLabel}: после возврата на scrollY=0 кнопка обязана снова стать серой`).toBe(border);
      expect(backToTop.color, `${themeLabel}: подпись после возврата`).toBe(text);

      await ctx.close();
    });
  }

  // ПРАВКА `2026-08-27` (`70-workshop/specs/site-v3/
  // 15-line-through-scale-brief.md`, раздел 4.1/4.2): порог считается от
  // `--line-head`, не от `0,67·vh` — граница пятого (последнего, самого
  // широкого) слоя переходит в «уже акцентная» там, где `--line-head ≥ 881`
  // (881 — нижняя кромка кнопки, конец диапазона, живая геометрия, не
  // тронута этой правкой). `--line-head = max(80vh, 100vh − 347)`, и при
  // `vh < 1735px` (обе проверяемые здесь высоты — 900 и ~1102 — далеко ниже)
  // это ровно `0,8·vh`: `vh ≥ 881 / 0,8 = 1101,25`, округлено вверх — 1102px.
  // Порог не затронут лестницей — это порог ПЯТОГО слоя, тот же самый, что
  // нёс единственный слой до неё.
  //
  // ПОБОЧНОЕ СЛЕДСТВИЕ ЛЕСТНИЦЫ (раздел 10.6, Р-3, не тронуто этой правкой):
  // у слоя `data-step="1"` (самого узкого) порог сдвинут РАНЬШЕ на 35,2px
  // прокрутки — между порогом первого и порогом пятого слоя кнопка при
  // scrollY=0 уже ЧАСТИЧНО акцентная. Здесь проверяются оба КРАЯ диапазона:
  // заведомо малая высота (900px, тот же VIEWPORT_1440_900, на которой
  // «серая при scrollY=0» уже проверена выше по всем пяти слоям) — кнопка
  // обязана быть ПОЛНОСТЬЮ серой; 1102px — ПОЛНОСТЬЮ акцентной.
  test('окно 900px: кнопка ещё полностью серая при загрузке; окно ≥1102px (граница по формуле --line-head ≥ 881, раздел 4.2 брифа 15-…): кнопка уже полностью акцентная (раздел 3, П2(г) — законное исключение из П-5)', async ({ browser }) => {
    const heightsAndExpected: [number, string][] = [
      [900, 'ещё-серая'],
      [1102, 'уже-акцентная'],
    ];
    for (const [height, expected] of heightsAndExpected) {
      const ctx = await browser.newContext({
        reducedMotion: 'no-preference',
        viewport: { width: 1440, height },
      });
      const page = await ctx.newPage();
      await page.goto('/');
      await page.waitForTimeout(1600);
      const c = await buttonColors(page);
      if (expected === 'ещё-серая') {
        expect(c.backgroundColor, `при высоте ${height}px кнопка обязана быть полностью серой`).toBe(BORDER_LIGHT);
      } else {
        expect(c.backgroundColor, `при высоте ${height}px кнопка обязана быть полностью акцентной`).toBe(ACCENT_LIGHT);
      }
      await ctx.close();
    }
  });

  test('prefers-reduced-motion: reduce — кнопка акцентная при scrollY=0, серого состояния нет ни в одном кадре, ни один из пяти слоёв не анимирован (П-6в, П-13)', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: VIEWPORT_1440_900 });
    const page = await ctx.newPage();
    await page.goto('/');
    const c = await buttonColors(page);
    expect(c.backgroundColor).toBe(ACCENT_LIGHT);
    expect(c.color).toBe(ON_ACCENT_LIGHT);
    const anims = await page.locator('#hero .cta .btn.primary').evaluate((el) => (el as HTMLElement).getAnimations().length);
    expect(anims, 'при reduce кнопка не обязана нести ни одной анимации рассказа').toBe(0);
    const stepAnims = await page.evaluate((nSteps: number) => {
      let total = 0;
      for (let step = 1; step <= nSteps; step += 1) {
        const el = document.querySelector(`#hero .cta .cta-ignite-step[data-step="${step}"]`) as HTMLElement | null;
        total += el ? el.getAnimations().length : 0;
      }
      return total;
    }, N_STEPS);
    expect(stepAnims, 'при reduce ни один из пяти слоёв лестницы не обязан нести анимацию').toBe(0);
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
 * раздел 12.1/12.5, В-2 «второй заход по размеченному референсу»): обвод
 * карточки «Корпоративный сайт» двумя полосами `.line-outline` (П3 старой
 * редакции, приёмка П-7) СНЯТ целиком — полоса `--accent` вставала поверх
 * постоянной рамки карточки и читалась как «лёгкое утолщение края», а не
 * как отдельное событие. Событие «главный блок» переехало к самой средней
 * линии: траверс `pricing` физически проходит СКВОЗЬ коробку карточки —
 * входит через одну кромку, выходит через другую. Блок ниже проверяет
 * именно это (приёмка П-21) и что обводки в разметке больше нет (приёмка
 * П-22), вместо прежних трёх тестов на `scaleY` полос, которые проверяли
 * механизм, которого больше нет.
 *
 * ПРАВКА `2026-08-27` (раздел 12.5, финальный реестр путей — предмет
 * изменился РЕШЕНИЕМ, не подгонкой): исследовательская ветка Р-2
 * (раздел 10.4/10.5 старой редакции, `d = M59,-60 L59,100 C59,579 941,579
 * 941,1058 L941,1218`, вход через ЛЕВУЮ кромку карточки, выход через
 * ПРАВУЮ) в `main` НИКОГДА не вливалась (раздел 12.1 брифа, «откатывать
 * нечего») — раздел 12 переписывает реестр путей заново по размеченному
 * референсу владельца, независимо от неё. Действующая геометрия (12.5,
 * строка `pricing`, `linePaths.ts`): пересечение карточки-акцента СПРАВА
 * НАЛЕВО — `d = M941,-60 L941,96 C920,690 260,350 240,1062 L240,1218`,
 * вход через ПРАВУЮ кромку на `vbY 518` под 65°, выход через ЛЕВУЮ на
 * `vbY 675` под 44°, хорда 299 vb. Обе точки пересечения дают угол ≥30°
 * (Г-5), внутри карточки лежит больше 240px краски — ядро требования
 * раздела 10.4 («войти через одну кромку и выйти через другую») не
 * страдает, только имена кромок поменялись местами. Сторож ниже проверяет
 * то, что СУЩЕСТВУЕТ и удовлетворяет числовому порогу П-21 (координаты
 * читаются из живого DOM, `getBoundingClientRect()`/`getPointAtLength()`
 * — раздел 5 брифа), а не имя кромки из прозы старой редакции. */
test.describe('линия-рассказчик — П21: карточка «Корпоративный сайт» пересечена линией (раздел 12.5 брифа; приёмка П-21)', () => {
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
    //
    // Было: `toBe('left')` — под геометрию исследовательской ветки Р-2
    // (раздел 10.4/10.5 старой редакции), которая в `main` не вливалась.
    // Стало (решение 12.5, `11-line-narrator-brief.md`, раздел 12.1/12.5):
    // финальный реестр путей, снятый по размеченному референсу владельца,
    // проходит карточку-акцент СПРАВА НАЛЕВО — вход через ПРАВУЮ кромку.
    expect(result!.entrySide, 'вход и выход обязаны быть через разные кромки')
      .not.toBe(result!.exitSide);
    expect(result!.entrySide, `линия обязана входить через ПРАВУЮ кромку (вошла через ${result!.entrySide})`).toBe('right');
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

test.describe('линия-рассказчик — зажигание цифр процесса (раздел 2 брифа `16-line-digits-and-finale-brief.md`; приёмка П-Ц1…П-Ц7)', () => {
  /** ПРАВКА `2026-08-27` (`70-workshop/specs/site-v3/16-line-digits-and-
   *  finale-brief.md`): весь блок «П4: спина шагов и подчёркивания цифр»
   *  (раздел 3 П4 и П-8/П-Т2 брифа `11-line-narrator-brief.md`) СНЯТ вместе
   *  с предметом — пяти отводов `LINE_PATHS.process.branch` больше нет.
   *  Цифра теперь зажигается сама: слой-дубликат `.num::after`, `opacity`
   *  0→1, `steps(1, jump-end)`, порог — нижняя кромка коробки цифры на
   *  экранной линии головы (раздел 2.3 брифа).
   *
   *  РАСХОЖДЕНИЕ С БРИФОМ (доложено, не подогнано молча — тот же приём,
   *  что уже несёт `linePaths.g5.test.ts`): раздел 2.3 брифа называет
   *  пороги `6338 · 6567 · 6796 · 6996 · 7225` (1440×900), выведенные ЧИСТОЙ
   *  АРИФМЕТИКОЙ («нижняя кромка коробки цифры (`docY`) минус `--line-head`
   *  в px»). Живой замер этим файлом (бисекция по РЕАЛЬНОМУ `opacity`
   *  `.num::after` на живой странице, две РАЗДЕЛЬНЫЕ команды `scrollTo`/
   *  чтение — см. предупреждение у `findStepThreshold` выше в этом файле:
   *  одна `evaluate()` со `scrollTo`+чтением внутри даёт один и тот же
   *  ложный порог для всех целей, ловушка уже документирована для лестницы
   *  кнопки первого экрана) даёт числа СИСТЕМАТИЧЕСКИ на ≈31–32px МЕНЬШЕ
   *  арифметики брифа на всех пяти целях сразу (`6305,6 · 6535,6 · 6764,6 ·
   *  6963,5 · 7193,6` при живом замере `2026-08-27`, порт 4601). Шаг между
   *  соседними порогами (≈229px) и порядок — те же, что предсказывает
   *  геометрия коробок цифр; расходится только АБСОЛЮТНАЯ точка. Причина
   *  не установлена этим заходом (кандидат — округление/базис процента
   *  `cover` внутри `animation-timeline: view()` у Chromium, не ошибка
   *  формулы `calc(100% - var(--line-head) - 12px)`: `getComputedStyle(el,
   *  '::after').animationRangeStart/End` показывает ТОЧНОЕ совпадение с
   *  `--line-head`, `732px`/`720px` — CSS применён верно). Тест ниже
   *  проверяет ФАКТИЧЕСКОЕ поведение (порядок, шаг, отсутствие
   *  промежуточного состояния, запас над появлением шага) и печатает
   *  фактические числа в отчёт — жёсткое сравнение с числами брифа
   *  вынесено в отдельную СЛАБУЮ проверку (широкий допуск, с целью не
   *  потерять сам факт расхождения, а не для прохождения любой ценой). */

  /** ДВЕ РАЗДЕЛЬНЫЕ команды `page.evaluate()` — `scrollTo`, ЗАТЕМ (второй
   *  самостоятельный round-trip) чтение стиля. Приём и предупреждение —
   *  `findStepThreshold` выше в этом файле (лестница кнопки первого
   *  экрана): прогресс `animation-timeline: view()` пересчитывается
   *  браузером на шаге рендеринга МЕЖДУ двумя поступившими от клиента
   *  командами, а не синхронно внутри одной JS-функции (двойной
   *  `requestAnimationFrame` ВНУТРИ одного `evaluate()` этого не даёт —
   *  проверено этим заходом: первая версия этого файла именно так и была
   *  написана и давала пороги на ≈650px позже настоящих). */
  async function digitAfterOpacity(
    page: import('@playwright/test').Page,
    index: number,
    scrollY: number,
  ): Promise<number> {
    await page.evaluate((y: number) => window.scrollTo(0, y), scrollY);
    const value = await page.evaluate((idx: number) => {
      const nums = Array.from(document.querySelectorAll('#process .step .num'));
      return getComputedStyle(nums[idx] as HTMLElement, '::after').opacity;
    }, index);
    return Number(value);
  }

  async function stepRevealOpacity(
    page: import('@playwright/test').Page,
    index: number,
    scrollY: number,
  ): Promise<number> {
    await page.evaluate((y: number) => window.scrollTo(0, y), scrollY);
    const value = await page.evaluate((idx: number) => {
      const steps = Array.from(document.querySelectorAll('#process .step.reveal'));
      return getComputedStyle(steps[idx] as HTMLElement).opacity;
    }, index);
    return Number(value);
  }

  /** Бисекция по живому `opacity` — находит наименьший `scrollY`, при
   *  котором слой зажигания уже полностью непрозрачен. Диапазон широкий
   *  (весь разумный участок документа вокруг секции `process`) и не
   *  анкерован на число брифа — если порог вообще не найден в диапазоне,
   *  тест обязан упасть на граничных проверках, а не молча вернуть край. */
  async function findIgniteThreshold(
    page: import('@playwright/test').Page,
    index: number,
    lo: number,
    hi: number,
  ): Promise<number> {
    const loOp = await digitAfterOpacity(page, index, lo);
    const hiOp = await digitAfterOpacity(page, index, hi);
    expect(loOp, `цифра №${index + 1}: на scrollY=${lo} слой зажигания уже непрозрачен — диапазон бисекции промахнулся снизу`).toBeLessThan(0.5);
    expect(hiOp, `цифра №${index + 1}: на scrollY=${hi} слой зажигания ещё не непрозрачен — диапазон бисекции промахнулся сверху`).toBeGreaterThanOrEqual(0.5);
    while (hi - lo > 1) {
      const mid = Math.round((lo + hi) / 2);
      const op = await digitAfterOpacity(page, index, mid);
      if (op >= 0.5) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  const BRIEF_EXPECTED_1440 = [6338, 6567, 6796, 6996, 7225];
  const BRIEF_EXPECTED_1180 = [6299, 6529, 6758, 6957, 7187];
  const SEARCH_RADIUS = 500;

  test('П-Ц1 (1440×900): пять порогов зажигания — упорядочены, равномерны, фактические числа названы', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: VIEWPORT_1440_900 });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(1600);

    const thresholds: number[] = [];
    for (let i = 0; i < 5; i++) {
      const lo = Math.max(0, BRIEF_EXPECTED_1440[i] - SEARCH_RADIUS);
      const hi = BRIEF_EXPECTED_1440[i] + SEARCH_RADIUS;
      thresholds.push(await findIgniteThreshold(page, i, lo, hi));
    }
    console.log(`П-Ц1 (1440×900) — фактические пороги: ${thresholds.join(' · ')} (брифа: ${BRIEF_EXPECTED_1440.join(' · ')}, расхождение: ${thresholds.map((t, i) => (t - BRIEF_EXPECTED_1440[i]).toFixed(1)).join(' · ')})`);

    // Порядок и равномерность — не зависят от того, чья арифметика точна:
    // пять порогов обязаны идти строго по возрастанию. Шаг НЕ одинаков —
    // раздел 2.3 брифа сам называет два разных шага коробок цифр: 229,3px
    // («высокий» шаг ведомости) и 199,6px («низкий» шаг, короче на одну
    // строку текста) — допуск обязан вмещать оба, а не только больший.
    for (let i = 1; i < 5; i++) {
      expect(thresholds[i], `порог цифры №${i + 1} обязан быть строго больше порога №${i}`).toBeGreaterThan(thresholds[i - 1]);
      const step = thresholds[i] - thresholds[i - 1];
      expect(step, `шаг между порогами №${i} и №${i + 1} = ${step}px, ожидалось 199,6 либо 229,3px (±15)`).toBeGreaterThanOrEqual(185);
      expect(step, `шаг между порогами №${i} и №${i + 1} = ${step}px, ожидалось 199,6 либо 229,3px (±15)`).toBeLessThanOrEqual(245);
    }

    // Слабая проверка соответствия числам брифа — широкий допуск (40px),
    // чтобы зафиксировать факт «в целом там же», не теряя дисциплину: если
    // расхождение выйдет за 40px, это уже не тот же порог, а другая точка.
    for (let i = 0; i < 5; i++) {
      const diff = Math.abs(thresholds[i] - BRIEF_EXPECTED_1440[i]);
      expect(diff, `цифра №${i + 1}: фактический порог ${thresholds[i]}px разошёлся с числом брифа ${BRIEF_EXPECTED_1440[i]}px больше чем на 40px`).toBeLessThanOrEqual(40);
    }

    // П-Ц3 — промежуточного состояния нет: на 6px раньше и на 6px позже
    // КАЖДОГО фактического порога `opacity` слоя зажигания стоит РОВНО в
    // одном из двух состояний (0 или 1), никогда между ними.
    for (let i = 0; i < 5; i++) {
      const before = await digitAfterOpacity(page, i, thresholds[i] - 6);
      const after = await digitAfterOpacity(page, i, thresholds[i] + 6);
      expect(before, `цифра №${i + 1}: opacity за 6px до порога обязан быть погашен (0)`).toBe(0);
      expect(after, `цифра №${i + 1}: opacity за 6px после порога обязан быть зажжён (1)`).toBe(1);
    }

    // П-Ц4 — зажигание не накладывается на появление шага: на пороге
    // зажигания `opacity` родительского `.step.reveal` уже равна 1, и
    // запас (насколько раньше порога зажигания появление шага уже
    // завершилось) — не меньше 24px.
    for (let i = 0; i < 5; i++) {
      const revealAtThreshold = await stepRevealOpacity(page, i, thresholds[i]);
      expect(revealAtThreshold, `цифра №${i + 1}: opacity шага в кадре зажигания = ${revealAtThreshold}, обязана быть 1`).toBe(1);

      let lo = Math.max(0, thresholds[i] - 500);
      let hi = thresholds[i];
      const loOp = await stepRevealOpacity(page, i, lo);
      expect(loOp, `цифра №${i + 1}: на scrollY=${lo} шаг уже полностью виден — диапазон бисекции запаса промахнулся`).toBeLessThan(1);
      while (hi - lo > 1) {
        const mid = Math.round((lo + hi) / 2);
        const op = await stepRevealOpacity(page, i, mid);
        if (op >= 1) hi = mid;
        else lo = mid;
      }
      const margin = thresholds[i] - hi;
      console.log(`П-Ц4: цифра №${i + 1} — запас до конца появления шага ${margin}px`);
      expect(margin, `цифра №${i + 1}: запас ${margin}px ниже порога 24px`).toBeGreaterThanOrEqual(24);
    }

    await ctx.close();
  });

  test('П-Ц1 (1180×900): пять порогов зажигания — упорядочены, равномерны, фактические числа названы', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1180, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(1600);

    const thresholds: number[] = [];
    for (let i = 0; i < 5; i++) {
      const lo = Math.max(0, BRIEF_EXPECTED_1180[i] - SEARCH_RADIUS);
      const hi = BRIEF_EXPECTED_1180[i] + SEARCH_RADIUS;
      thresholds.push(await findIgniteThreshold(page, i, lo, hi));
    }
    console.log(`П-Ц1 (1180×900) — фактические пороги: ${thresholds.join(' · ')} (брифа: ${BRIEF_EXPECTED_1180.join(' · ')}, расхождение: ${thresholds.map((t, i) => (t - BRIEF_EXPECTED_1180[i]).toFixed(1)).join(' · ')})`);

    // Тот же допуск, что у 1440×900 выше — шаг может быть 199,6 либо
    // 229,3px в зависимости от высоты конкретного шага ведомости.
    for (let i = 1; i < 5; i++) {
      expect(thresholds[i], `порог цифры №${i + 1} обязан быть строго больше порога №${i}`).toBeGreaterThan(thresholds[i - 1]);
      const step = thresholds[i] - thresholds[i - 1];
      expect(step, `шаг между порогами №${i} и №${i + 1} = ${step}px, ожидалось 199,6 либо 229,3px (±15)`).toBeGreaterThanOrEqual(185);
      expect(step, `шаг между порогами №${i} и №${i + 1} = ${step}px, ожидалось 199,6 либо 229,3px (±15)`).toBeLessThanOrEqual(245);
    }
    for (let i = 0; i < 5; i++) {
      const diff = Math.abs(thresholds[i] - BRIEF_EXPECTED_1180[i]);
      expect(diff, `цифра №${i + 1}: фактический порог ${thresholds[i]}px разошёлся с числом брифа ${BRIEF_EXPECTED_1180[i]}px больше чем на 40px`).toBeLessThanOrEqual(40);
    }
    await ctx.close();
  });

  test('П-Ц2: конечное состояние вниз→вверх→вниз — все пять акцентные, все пять серые, снова все пять акцентные', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: VIEWPORT_1440_900 });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.waitForTimeout(1600);

    const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);

    async function settleAt(y: number) {
      await page.evaluate((yy: number) => window.scrollTo(0, yy), y);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(undefined)))));
    }
    async function allOpacities(): Promise<number[]> {
      return page.evaluate(() =>
        Array.from(document.querySelectorAll('#process .step .num')).map((el) =>
          Number(getComputedStyle(el as HTMLElement, '::after').opacity),
        ),
      );
    }

    await settleAt(maxScroll);
    expect(await allOpacities(), 'на maxScroll все пять цифр обязаны быть зажжены').toEqual([1, 1, 1, 1, 1]);

    await settleAt(0);
    expect(await allOpacities(), 'на scrollY=0 все пять цифр обязаны быть погашены').toEqual([0, 0, 0, 0, 0]);

    await settleAt(maxScroll);
    expect(await allOpacities(), 'повторная прокрутка вниз — все пять цифр снова обязаны быть зажжены').toEqual([1, 1, 1, 1, 1]);

    await ctx.close();
  });

  test('П-Ц5: отводов к цифрам больше нет — ровно один <path> в #process svg.line, .line-branch отсутствует', async ({ page }) => {
    await page.setViewportSize(VIEWPORT_1440_900);
    await page.goto('/');

    const pathCount = await page.locator('#process svg.line > path').count();
    expect(pathCount, '#process svg.line обязан нести ровно один <path>').toBe(1);

    const branchCount = await page.locator('#process svg.line path.line-branch').count();
    expect(branchCount, 'в #process не должно остаться ни одного path.line-branch').toBe(0);
  });

  test('П-Ц6: reduce — все пять цифр акцентные, слой зажигания не порождён', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: VIEWPORT_1440_900 });
    const page = await ctx.newPage();
    await page.goto('/');

    const colors = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#process .step .num')).map((el) => getComputedStyle(el as HTMLElement).color),
    );
    const accentHex = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
    const accentColor = hexToRgbString(accentHex);
    for (const c of colors) {
      expect(c, `reduce: цвет цифры ${c} обязан быть акцентным (${accentColor}) уже на scrollY=0`).toBe(accentColor);
    }
    const afterContents = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#process .step .num')).map((el) => getComputedStyle(el as HTMLElement, '::after').content),
    );
    for (const c of afterContents) {
      expect(c, 'reduce: .num::after обязан не порождаться (content: none)').toBe('none');
    }
    await ctx.close();
  });

  test('П-Ц6: forced-colors — слой зажигания снят (content: none)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: VIEWPORT_1440_900, forcedColors: 'active' });
    const page = await ctx.newPage();
    await page.goto('/');
    const afterContents = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#process .step .num')).map((el) => getComputedStyle(el as HTMLElement, '::after').content),
    );
    for (const c of afterContents) {
      expect(c, 'forced-colors: .num::after обязан не порождаться (content: none)').toBe('none');
    }
    await ctx.close();
  });

  test('П-Ц6: печать — слой зажигания снят, цифра акцентная', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: VIEWPORT_1440_900 });
    const page = await ctx.newPage();
    await page.goto('/');
    await page.emulateMedia({ media: 'print' });
    const afterContents = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#process .step .num')).map((el) => getComputedStyle(el as HTMLElement, '::after').content),
    );
    for (const c of afterContents) {
      expect(c, 'печать: .num::after обязан не порождаться (content: none)').toBe('none');
    }
    // Ожидание ниже — не подгонка под красный прогон, а инструментальный
    // артефакт, найденный этим заходом: `.num` цвет уходит из-под гейта
    // `screen and (...)` на `var(--accent)` РОВНО в момент `emulateMedia`,
    // но глобальный переход `*, *::before, *::after { transition: color
    // var(--dur-micro) ... }` (`base.css`, `--dur-micro: 160ms`, заведён для
    // плавной смены темы) начинает интерполировать цвет от `--text-muted` к
    // `--accent` тем же кадром — измерение сразу после `emulateMedia` ловит
    // цвет В ПОЛЁТЕ (замер этим заходом: 0мс → rgb(76,98,163), 150мс → ровно
    // акцент). `content: none` выше не задет тем же эффектом — это НЕ
    // custom-property, а литеральное значение, интерполяции не подлежит.
    // Ждём дольше `--dur-micro`, чтобы переход гарантированно завершился.
    await page.waitForTimeout(200);
    const colors = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#process .step .num')).map((el) => getComputedStyle(el as HTMLElement).color),
    );
    const accentHex = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
    const accentColor = hexToRgbString(accentHex);
    for (const c of colors) {
      expect(c, 'печать: цвет цифры обязан быть акцентным').toBe(accentColor);
    }
    await ctx.close();
  });

  test('П-Ц6: ширина < 900px — все пять цифр акцентные, слой зажигания не порождён', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 768, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('/');
    const afterContents = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#process .step .num')).map((el) => getComputedStyle(el as HTMLElement, '::after').content),
    );
    for (const c of afterContents) {
      expect(c, 'ниже 900px: .num::after обязан не порождаться (content: none)').toBe('none');
    }
    const colors = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#process .step .num')).map((el) => getComputedStyle(el as HTMLElement).color),
    );
    const accentHex = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
    const accentColor = hexToRgbString(accentHex);
    for (const c of colors) {
      expect(c, 'ниже 900px: цвет цифры обязан быть акцентным').toBe(accentColor);
    }
    await ctx.close();
  });

  test('П-Ц7: диктор не видит дубликат — .num несёт aria-hidden', async ({ page }) => {
    await page.setViewportSize(VIEWPORT_1440_900);
    await page.goto('/');
    const ariaHidden = await page.locator('#process .step .num').first().getAttribute('aria-hidden');
    expect(ariaHidden, '.num обязан нести aria-hidden="true"').toBe('true');
  });
});

/** Переводит `#rrggbb`, прочитанный из CSS-переменной в Node (после
 *  `page.evaluate`, не внутри него — `page.evaluate` сериализует функцию
 *  по значению и не имеет доступа к замыканию модуля, поэтому конвертация
 *  сделана ПОСЛЕ возврата в Node), в формат, который отдаёт
 *  `getComputedStyle().color` (`rgb(r, g, b)`) — сравнение строк без
 *  стороннего парсера цвета. */
function hexToRgbString(value: string): string {
  const hex = value.replace('#', '').trim();
  if (hex.length !== 6) return value; // уже rgb(...) или иной формат — сравнивать как есть
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

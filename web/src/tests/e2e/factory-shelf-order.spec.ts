import { test, expect } from '@playwright/test';

/* Сторож порядка появления «Стеллажа» (правка 2026-08-18): владелец увидел
 * на живой странице, что схема проявляется СВЕРХУ ВНИЗ («сначала верхняя
 * ветка целиком, потом следующая»), хотя читается схема СЛЕВА НАПРАВО (узел
 * → гребёнка → ветки с подписями → плитки тем → подпись пучка). Причина —
 * у каждого элемента был СВОЙ анонимный `animation-timeline: view()`: его
 * прогресс считается от положения САМОГО ЭЛЕМЕНТА на странице, и нижняя
 * полка неизбежно входит в кадр позже верхней. Починка —
 * `CaseFactoryIllustration.astro`: один именованный таймлайн (`--cfr`,
 * источник `.cf-stellar`), порядок задаёт только `animation-range`.
 *
 * Этот тест не читает CSS-текст (там `animation-range` — литерал что до
 * правки, что после: старый код тоже писал числа, просто на РАЗНЫХ
 * таймлайнах). Единственный способ отличить старое поведение от нового —
 * прокрутить страницу по-настоящему и замерить, в какой момент (`scrollY`)
 * каждый узел ФАКТИЧЕСКИ начинает меняться, как уже делает
 * `case-weight-motion.spec.ts` для полосы «Замера».
 *
 * ЛОВУШКА headless-Chromium: без явной эмуляции `no-preference` браузер
 * отдаёт `prefers-reduced-motion: reduce», и тест вхолостую проверял бы
 * запасное состояние. */

const WIDE = { width: 1440, height: 1000 };
const STEP = 12; // px — достаточно мелко, чтобы поймать первый кадр движения
                  // в пределах фазы `entry` (352px высота поля на раскрое А)

type Sample = {
  nodeOpacity: number;
  branchTransform: string;
  shelvesTransform: string;
  stemFirstTransform: string;
  stemLastTransform: string;
  labelFirstOpacity: number;
  labelLastOpacity: number;
  marksFirstClip: string;
  marksLastClip: string;
  captionOpacity: number;
};

async function sample(page: import('@playwright/test').Page): Promise<Sample> {
  return page.evaluate(() => {
    const node = document.querySelector('.cf-node') as HTMLElement;
    const branch = document.querySelector('.cf-branch') as HTMLElement;
    const shelves = document.querySelector('.cf-shelves') as HTMLElement;
    const shelfEls = Array.from(document.querySelectorAll('.cf-shelf'));
    const first = shelfEls[0] as HTMLElement;
    const last = shelfEls[shelfEls.length - 1] as HTMLElement;
    const marksEls = Array.from(document.querySelectorAll('.cf-marks'));
    const marksFirst = marksEls[0] as HTMLElement;
    const marksLast = marksEls[marksEls.length - 1] as HTMLElement;
    const labelFirst = first.querySelector('.cf-shelf-label') as HTMLElement;
    const labelLast = last.querySelector('.cf-shelf-label') as HTMLElement;
    const caption = document.querySelector('.cf-caption') as HTMLElement;
    return {
      nodeOpacity: Number(getComputedStyle(node).opacity),
      branchTransform: getComputedStyle(branch).transform,
      shelvesTransform: getComputedStyle(shelves).transform,
      stemFirstTransform: getComputedStyle(first, '::before').transform,
      stemLastTransform: getComputedStyle(last, '::before').transform,
      labelFirstOpacity: Number(getComputedStyle(labelFirst).opacity),
      labelLastOpacity: Number(getComputedStyle(labelLast).opacity),
      marksFirstClip: getComputedStyle(marksFirst).clipPath,
      marksLastClip: getComputedStyle(marksLast).clipPath,
      captionOpacity: Number(getComputedStyle(caption).opacity),
    };
  });
}

/** Ряд стартов (в px прокрутки) по каждой фазе — первый `scrollY`, на
 *  котором значение отличается от состояния покоя (снятого выше окна
 *  прокрутки, где `.cf-stellar` заведомо ещё не в кадре). `null` — движение
 *  так и не замечено до конца прохода (дефект сам по себе, тест ниже это
 *  ловит).
 *
 *  Окно прохода — не вся страница, а полоса вокруг блока: `scrollIntoView`
 *  даёт «якорь» (тот `scrollY`, на котором браузер центрирует блок в
 *  вьюпорте), и прогон идёт от «якорь − высота вьюпорта» до «якорь + высота
 *  поля». Запаса хватает на всю фазу `entry` СТАРОГО поведения тоже (там
 *  весь верх-низ разброс укладывался в размер самого поля, много меньше
 *  вьюпорта) — при этом проход остаётся коротким и укладывается в таймаут
 *  теста независимо от версии кода (полный проход по всей странице на
 *  старом коде однажды не уложился в 30с и упал таймаутом, а не
 *  осмысленным утверждением — не то падение, которое нужно). */
async function measureStarts(page: import('@playwright/test').Page) {
  const stellar = page.locator('.cf-stellar');
  await stellar.scrollIntoViewIfNeeded();
  const anchor = await page.evaluate(() => window.scrollY);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const fieldHeight = await stellar.evaluate((el) => el.getBoundingClientRect().height);
  const from = Math.max(0, anchor - viewportHeight);
  const to = anchor + fieldHeight;

  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' as ScrollBehavior }), from);
  const resting = await sample(page);

  const starts: Record<keyof Sample, number | null> = {
    nodeOpacity: null,
    branchTransform: null,
    shelvesTransform: null,
    stemFirstTransform: null,
    stemLastTransform: null,
    labelFirstOpacity: null,
    labelLastOpacity: null,
    marksFirstClip: null,
    marksLastClip: null,
    captionOpacity: null,
  };

  for (let y = from; y <= to; y += STEP) {
    // Скролл-таймлайн пересчитывает `currentTime` не синхронно с
    // `scrollTo`, а на следующем кадре компоновки — без ожидания кадра
    // `getComputedStyle` читает значение ПРЕДЫДУЩЕГО кадра, и несколько
    // разных фаз кажутся стартующими в один и тот же шаг прокрутки.
    await page.evaluate((top) => new Promise<void>((resolve) => {
      window.scrollTo({ top, behavior: 'instant' as ScrollBehavior });
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }), y);
    const s = await sample(page);
    for (const key of Object.keys(starts) as (keyof Sample)[]) {
      if (starts[key] !== null) continue;
      if (s[key] !== resting[key]) starts[key] = y;
    }
    if (Object.values(starts).every((v) => v !== null)) break;
  }
  return { starts, resting };
}

test.describe('«Стеллаж» — порядок появления слева направо, не сверху вниз', () => {
  test('узел → гребёнка → ветки (почти одновременно) → плитки → подпись — монотонно по scrollY', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'no-preference', viewport: WIDE });
    const page = await context.newPage();
    await page.goto('/');

    const { starts } = await measureStarts(page);

    for (const [key, value] of Object.entries(starts)) {
      expect(value, `«${key}» не сдвинулся ни разу за проход — либо не анимируется, либо тест не тот путь`)
        .not.toBeNull();
    }
    const s = starts as Record<keyof Sample, number>;

    // Макро-порядок: узел раньше гребёнки, гребёнка раньше веток, ветки
    // раньше плиток, плитки раньше подписи (раздел «что требуется», пункты
    // 1–5). Сравниваем САМЫЙ ранний старт своей фазы против САМОГО ПОЗДНЕГО
    // старта предыдущей — иначе «почти одновременно» внутри фазы 3
    // (нечётные/чётные ряды) выглядело бы ложным нарушением порядка.
    expect(s.nodeOpacity, 'узел появляется не раньше гребёнки').toBeLessThan(s.branchTransform);
    expect(s.nodeOpacity, 'узел появляется не раньше шины').toBeLessThan(s.shelvesTransform);

    const branchPhaseEnd = Math.max(s.branchTransform, s.shelvesTransform);
    const stemsPhaseStart = Math.min(s.stemFirstTransform, s.stemLastTransform, s.labelFirstOpacity, s.labelLastOpacity);
    expect(branchPhaseEnd, 'гребёнка появляется не раньше веток').toBeLessThanOrEqual(stemsPhaseStart);

    const stemsPhaseEnd = Math.max(s.stemFirstTransform, s.stemLastTransform, s.labelFirstOpacity, s.labelLastOpacity);
    const marksPhaseStart = Math.min(s.marksFirstClip, s.marksLastClip);
    expect(stemsPhaseEnd, 'ветки появляются не раньше плиток').toBeLessThanOrEqual(marksPhaseStart);

    const marksPhaseEnd = Math.max(s.marksFirstClip, s.marksLastClip);
    expect(marksPhaseEnd, 'плитки появляются не раньше подписи пучка').toBeLessThanOrEqual(s.captionOpacity);

    // Порядок ВНУТРИ фазы веток/плиток читается как «почти одновременно, с
    // малым сдвигом» (раздел «что требуется»), а не как прежняя очередь
    // «сверху вниз» с разрывом в размер всего ряда полок. Разрыв между
    // первой и последней полкой ограничен сверху — число ниже (120px)
    // выбрано между фактическим замером старого поведения (см. отчёт задачи:
    // разрыв там на порядок больше поля высотой 352px) и малым сдвигом
    // новой хореографии (проектные 3 п.п. фазы 3 ≈ десяток пикселей).
    const stemSpread = Math.abs(s.stemFirstTransform - s.stemLastTransform);
    expect(stemSpread, `разрыв между первой и последней веткой ${stemSpread}px — похоже на «сверху вниз», а не на малый сдвиг`)
      .toBeLessThan(120);
    const marksSpread = Math.abs(s.marksFirstClip - s.marksLastClip);
    expect(marksSpread, `разрыв между первым и последним рядом плиток ${marksSpread}px — похоже на «сверху вниз», а не на малый сдвиг`)
      .toBeLessThan(120);

    await context.close();
  });
});

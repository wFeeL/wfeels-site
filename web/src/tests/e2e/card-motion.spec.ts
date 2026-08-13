import { test, expect } from '@playwright/test';

/* Сторож появления карточек ([[02-card-motion]]).
 *
 * Самый дорогой отказ этой анимации — не «некрасиво», а «контента нет»:
 * карточка входит из `opacity: 0`, и если таймлайн прокрутки не сработал
 * (браузер без поддержки, ошибка в диапазоне, сокращение `animation:`,
 * которое сборка сводит в форму, роняемую Chromium), человек видит пустое
 * поле вместо услуг и цен. Сборка при этом зелёная, юнит-тесты зелёные,
 * бюджет зелёный — молчат все.
 *
 * Поэтому проверяется ФАКТИЧЕСКАЯ непрозрачность после прохода страницы, а
 * не наличие правила в CSS. Правило можно написать и перекрыть соседним. */

const WIDE = { width: 1440, height: 900 };

/** Все карточки главной: услуги, крупные и малые цены, гарантии, полосы кейсов. */
const CARD_SELECTOR = '.reveal';

test.describe('появление карточек — ни одна не остаётся невидимой', () => {
  test('каждая карточка непрозрачна, когда она в кадре', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');

    const cards = page.locator(CARD_SELECTOR);
    const count = await cards.count();
    expect(count, 'на странице не нашлось карточек с .reveal — либо утилиту ' +
      'переименовали, либо сторож перестал сторожить').toBeGreaterThan(10);

    /* Меряем каждую карточку В КАДРЕ, а не после прохода всей страницы.
       Появление привязано к положению прокрутки, а не ко времени: уехавшая
       вверх карточка честно возвращается в исходное состояние, и замер после
       возврата наверх показал бы ноль у всех — что и случилось в первой
       редакции этого теста. Ошибка была в тесте, не в коде. */
    const hidden: string[] = [];
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(60);
      const info = await card.evaluate((el) => ({
        opacity: Number(getComputedStyle(el).opacity),
        text: (el.textContent ?? '').trim().slice(0, 36),
      }));
      if (info.opacity < 0.99) hidden.push(`#${i} opacity=${info.opacity} «${info.text}»`);
    }

    expect(hidden, `невидимых в кадре карточек: ${hidden.length}\n${hidden.join('\n')}`)
      .toEqual([]);
  });

  test('при уменьшенном движении карточки видны сразу, без прокрутки', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: WIDE });
    const page = await context.newPage();
    await page.goto('/');

    const hidden = await page.locator(CARD_SELECTOR).evaluateAll((els) =>
      els.filter((el) => Number(getComputedStyle(el).opacity) < 0.99).length,
    );
    expect(hidden, 'при prefers-reduced-motion карточка обязана быть видна сразу').toBe(0);
    await context.close();
  });

  /* Два теста выше пройдут и в том случае, если анимация не применилась
     вовсе: непрозрачная карточка непрозрачна и без движения. Этот тест
     отличает работающее появление от отсутствующего — иначе сторож
     вырождается в тавтологию, а именно этот класс дефекта здесь ловили
     семь раз за две сессии. */
  test('появление действительно происходит: в проходе есть полупрозрачные карточки', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/');

    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    let seenMidFlight = 0;

    /* Шаг 80 px, а не 200: окно появления крупной карточки — около 240 px
       хода, и шаг в 200 через него перешагивает через раз. Тест на этом
       краснел при исправном коде — брак был в замере, не в анимации.
       Уменьшать шаг дальше незачем, увеличивать нельзя. */
    for (let y = 0; y <= height; y += 80) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' as ScrollBehavior }), y);
      seenMidFlight += await page.locator(CARD_SELECTOR).evaluateAll((els) =>
        els.filter((el) => {
          const o = Number(getComputedStyle(el).opacity);
          return o > 0.01 && o < 0.99;
        }).length,
      );
      if (seenMidFlight > 0) break;
    }

    expect(
      seenMidFlight,
      'ни одна карточка ни разу не оказалась в полёте — значит появление не ' +
      'применяется, а два теста выше проходят вхолостую',
    ).toBeGreaterThan(0);
  });
});

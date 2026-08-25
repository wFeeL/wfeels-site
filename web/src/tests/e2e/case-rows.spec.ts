import { test, expect } from '@playwright/test';

/* Секция 5 (бриф `70-workshop/specs/site-v3/04-cases-brief.md`, разделы 2–3)
 * — полноширинные блоки вместо карточек: текст и поле иллюстрации,
 * зеркалящиеся по формуле `homeOrder % 2 === 0`. Тесты ниже проверяют
 * геометрию, зеркало и честный переход на построенную detail-страницу, не
 * текст (текст и его дословность проверяет `dist-home-cases.test.ts`). */

/* Появление полос кейсов по прокрутке сдвигает `.text` и `.illustration»
 * по-разному в момент замера — тесты ниже проверяют раскладку, а не
 * движение. `reducedMotion: 'reduce'` даёт чистую раскладку (бриф, раздел
 * 8.1). Допуски не ослабляются. */
test.use({ reducedMotion: 'reduce' });

test.describe('секция 5 — полноширинные блоки кейсов, чередование сторон', () => {
  test('desktop (1280px): чередование сторон и одна ссылка на detail-страницу', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto('/');

    const rows = page.locator('#cases .rows > .row');
    const count = await rows.count();
    /* С правки владельца 2026-08-20 блок ОДИН. Порог опущен до одного, а не
       снят: пустая секция обязана ронять прогон, а зеркальность при одном
       блоке проверяет `data/cases.test.ts` — здесь цикл ниже всё равно
       сверит сторону каждого блока формулой, сколько бы их ни было. */
    expect(count, 'секция кейсов пуста').toBeGreaterThanOrEqual(1);

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const mirrored = (i + 1) % 2 === 0; // homeOrder — 1-based, чётный — зеркало

      const links = row.locator('a');
      await expect(links, `блок ${i}: ровно один переход в заголовке`).toHaveCount(1);
      await expect(links).toHaveAttribute('href', /^\/cases\/[a-z0-9-]+$/);

      const textBox = await row.locator('.text').boundingBox();
      const fieldBox = await row.locator('.field').boundingBox();
      expect(textBox, `блок ${i}: текстовая колонка`).not.toBeNull();
      expect(fieldBox, `блок ${i}: поле иллюстрации`).not.toBeNull();

      // Сторона чередуется: нечётный homeOrder — текст слева (поле правее
      // текста), чётный — зеркало (поле левее текста), бриф раздел 2.1/2.3.
      if (mirrored) {
        expect(fieldBox!.x, `блок ${i} (зеркало): поле левее текста`).toBeLessThan(textBox!.x);
      } else {
        expect(fieldBox!.x, `блок ${i}: поле правее текста`).toBeGreaterThan(textBox!.x);
      }

      // Содержимое поля не пусто.
      const childCount = await row.locator('.field').evaluate((el) => el.childElementCount);
      expect(childCount, `блок ${i}: поле иллюстрации не пусто`).toBeGreaterThan(0);

      /* ПРАВКА ВЛАДЕЛЬЦА 2026-08-26: в ПОКОЕ подчёркивания у заголовка кейса
         больше нет — владелец прислал три снимка и попросил убрать линию под
         словами. Раньше здесь стояло обратное требование («подчёркивание
         видно до наведения»), и сторож покраснел этой правкой ПРАВИЛЬНО: он
         охранял прежнее правило.

         Проверка не ослаблена, а перенацелена и расширена. Ослаблением было
         бы снять её вовсе — тогда заголовок мог бы молча стать неотличимым от
         обычного текста, и сайт получил бы кейсы, о кликабельности которых
         читатель не догадывается. Поэтому проверяются ТРИ вещи: в покое
         подчёркивания нет (правка владельца исполнена), курсор по-прежнему
         сообщает о переходе, и при наведении отклик появляется — ссылка не
         осталась совсем без признака. */
      const link = row.locator('h3 a');

      const atRest = await link.evaluate((el) => {
        const s = getComputedStyle(el);
        return { decoration: s.textDecorationLine, cursor: s.cursor };
      });
      expect(atRest.decoration, `блок ${i}: в покое подчёркивания быть не должно`)
        .not.toContain('underline');
      expect(atRest.cursor, `блок ${i}: курсор-указатель`).toBe('pointer');

      await link.hover();
      const hovered = await link.evaluate((el) => getComputedStyle(el).textDecorationLine);
      expect(hovered, `блок ${i}: при наведении отклик обязан появиться`).toContain('underline');

      // Грани слева больше нет: она метила блок как ссылку.
      const borderLeftWidth = await row.evaluate((el) => getComputedStyle(el).borderLeftWidth);
      expect(borderLeftWidth, `блок ${i}: грань слева снята вместе со ссылкой`).toBe('0px');
    }
  });

  test('mobile (390px): блок одноколоночный — сначала текст, потом поле иллюстрации, зеркало отключено', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1400 });
    await page.goto('/');

    const rows = page.locator('#cases .rows > .row');
    const count = await rows.count();

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const textBox = await row.locator('.text').boundingBox();
      const fieldBox = await row.locator('.field').boundingBox();
      expect(textBox, `блок ${i}`).not.toBeNull();
      expect(fieldBox, `блок ${i}`).not.toBeNull();
      // Одна колонка: поле иллюстрации стоит НИЖЕ текста, не правее и не
      // левее него — зеркало ниже 900 px не имеет эффекта (бриф, 2.3).
      expect(fieldBox!.y, `блок ${i}: поле ниже текста на мобильном`).toBeGreaterThanOrEqual(
        textBox!.y + textBox!.height - 1,
      );
    }
  });

  /* Было «визуально одна строка»: описание обрезалось `text-overflow:
     ellipsis` при `white-space: nowrap`. Дизайн-ревью 2026-08-13 замерило,
     что видно 22–29% предложения — три оборванных на полуслове фразы подряд
     читались как битая вёрстка, и владелец отменил приём. Тест не удалён, а
     вывернут: теперь он требует обратного — что описание НЕ обрезано в одну
     строку и при этом не растёт бесконечно. */
  test('описание кейса — не обрезано в одну строку', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto('/');

    const descriptions = page.locator('#cases .rows .description');
    const count = await descriptions.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const el = descriptions.nth(i);
      const m = await el.evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          lineHeight: parseFloat(style.lineHeight),
          height: node.getBoundingClientRect().height,
          scrollWidth: node.scrollWidth,
          clientWidth: node.clientWidth,
          whiteSpace: style.whiteSpace,
        };
      });

      const lines = Math.round(m.height / m.lineHeight);

      expect(m.whiteSpace, `описание ${i}: nowrap возвращает усечение в одну строку`)
        .not.toBe('nowrap');
      expect(lines, `описание ${i}: занимает ${lines} строк, потолок 6`)
        .toBeLessThanOrEqual(6);
      expect(
        m.scrollWidth,
        `описание ${i}: текст шире своей колонки на ${m.scrollWidth - m.clientWidth} px — ` +
        'значит он всё ещё обрезан по горизонтали, а не перенесён',
      ).toBeLessThanOrEqual(m.clientWidth + 1);
    }
  });

  test('клавиатура: у каждого кейса есть detail-ссылка, галереи сохраняют свои кнопки', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto('/');

    await expect(page.locator('#cases .rows > .row a.case-title-link')).toHaveCount(3);
    const buttons = page.locator('#cases [data-case-gallery] button');
    await expect(buttons).toHaveCount(4);
    await expect(page.locator('#cases [data-storefront-gallery] [data-step]')).toHaveCount(2);
    await expect(page.locator('#cases [data-website-gallery] [data-step]')).toHaveCount(2);
    await expect(page.locator('#cases [data-storefront-gallery] [data-app-index]')).toHaveCount(0);
    await expect(page.locator('#cases [data-storefront-gallery] [data-screen-index]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Предыдущий экран', exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Следующий экран', exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Предыдущий экран сайта' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Следующий экран сайта' })).toHaveCount(1);
  });
});

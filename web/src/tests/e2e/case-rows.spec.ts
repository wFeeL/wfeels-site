import { test, expect } from '@playwright/test';

/* Секция 5 (бриф `70-workshop/specs/site-v3/04-cases-brief.md`, разделы 2–3)
 * — полноширинные блоки вместо карточек: текст и поле иллюстрации,
 * зеркалящиеся по формуле `homeOrder % 2 === 0`, весь блок — ссылка (D-047,
 * вариант В). Тесты ниже проверяют геометрию, зеркало и ссылки, не текст
 * (текст и его дословность проверяет `dist-home-cases.test.ts`). */

/* Появление полос кейсов по прокрутке сдвигает `.text` и `.illustration»
 * по-разному в момент замера — тесты ниже проверяют раскладку, а не
 * движение. `reducedMotion: 'reduce'` даёт чистую раскладку (бриф, раздел
 * 8.1). Допуски не ослабляются. */
test.use({ reducedMotion: 'reduce' });

test.describe('секция 5 — полноширинные блоки кейсов, чередование сторон', () => {
  test('desktop (1280px): чередование сторон, ровно один <a> на блок', async ({ page }) => {
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

      // Ровно один <a> на блок (D-047, раздел 3.1) — заголовок, растянутый
      // на весь блок приёмом `a::after`.
      const links = row.locator('a');
      await expect(links, `блок ${i}: ровно один <a>`).toHaveCount(1);

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

      // Доступное имя ссылки равно заголовку кейса (критерий приёмки 5).
      const [linkText, h3Text] = await Promise.all([
        links.first().innerText(),
        row.locator('h3').innerText(),
      ]);
      expect(linkText.trim()).toBe(h3Text.trim());

      // Грань слева существует у всех блоков, включая зеркальные (бриф,
      // раздел 3.1: «она метит блок, а не колонку»).
      const borderLeftWidth = await row.evaluate((el) => getComputedStyle(el).borderLeftWidth);
      expect(borderLeftWidth, `блок ${i}: грань слева`).toBe('2px');
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

  test('клавиатура: :focus-visible виден на ссылке блока и не обрезан родителем', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto('/');

    const firstLink = page.locator('#cases .rows > .row').first().locator('a').first();
    await firstLink.focus();
    const outline = await firstLink.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline, 'заголовок-ссылка не показывает :focus-visible').toBe('solid');

    const overflow = await page.locator('#cases .rows > .row').first().evaluate(
      (el) => getComputedStyle(el).overflow,
    );
    expect(overflow, 'у .row не должно быть overflow: hidden — обрежет обводку фокуса')
      .not.toBe('hidden');
  });
});

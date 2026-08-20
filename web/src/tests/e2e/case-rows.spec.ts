import { test, expect } from '@playwright/test';

/* Секция 5 (бриф `70-workshop/specs/site-v3/04-cases-brief.md`, разделы 2–3)
 * — полноширинные блоки вместо карточек: текст и поле иллюстрации,
 * зеркалящиеся по формуле `homeOrder % 2 === 0`. Тесты ниже проверяют
 * геометрию, зеркало и отсутствие перехода, не текст (текст и его
 * дословность проверяет `dist-home-cases.test.ts`).
 *
 * Ссылки в блоке БОЛЬШЕ НЕТ — правка владельца 2026-08-20 сняла её вместе с
 * меткой «Разобрать кейс →»: страницы `/cases/<slug>` не существует. Тесты
 * не удалены, а вывернуты: там, где раньше требовался ровно один `<a>` на
 * блок (вариант В «Цель — весь блок», D-047), теперь требуется ни одного, и
 * отдельно проверяется, что на месте снятой ссылки не осталось её вида. */

/* Появление полос кейсов по прокрутке сдвигает `.text` и `.illustration»
 * по-разному в момент замера — тесты ниже проверяют раскладку, а не
 * движение. `reducedMotion: 'reduce'` даёт чистую раскладку (бриф, раздел
 * 8.1). Допуски не ослабляются. */
test.use({ reducedMotion: 'reduce' });

test.describe('секция 5 — полноширинные блоки кейсов, чередование сторон', () => {
  test('desktop (1280px): чередование сторон, ни одной ссылки в блоке', async ({ page }) => {
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

      // Ни одного <a> в блоке: заголовок перестал быть ссылкой, метка
      // «Разобрать кейс →» снята (правка владельца 2026-08-20).
      const links = row.locator('a');
      await expect(links, `блок ${i}: переход из блока снят — ссылок быть не должно`)
        .toHaveCount(0);

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

      // Заголовок остался текстом и выглядит текстом. Дизайн-ревью
      // 2026-08-20 отмечало обратный дефект — ссылку, не похожую на ссылку;
      // после снятия ссылки опасность зеркальная: вид ссылки без ссылки.
      const heading = await row.locator('h3').evaluate((el) => {
        const s = getComputedStyle(el);
        return { decoration: s.textDecorationLine, cursor: s.cursor };
      });
      expect(heading.decoration, `блок ${i}: подчёркивание на заголовке`).toBe('none');
      expect(heading.cursor, `блок ${i}: курсор-указатель на заголовке`).not.toBe('pointer');

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

  /* Прежде здесь стоял сторож `:focus-visible` на заголовке-ссылке. Ссылки
     нет — проверять фокус не на чем, и тест вывернут в проверку того, что
     блок вообще выпал из порядка обхода с клавиатуры: остаточный фокус на
     элементе, из которого некуда перейти, был бы ловушкой для клавиатуры. */
  test('клавиатура: в блоке кейса нет ни одной точки остановки', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto('/');

    const focusable = page.locator(
      '#cases .rows > .row a, #cases .rows > .row button, #cases .rows > .row [tabindex]',
    );
    await expect(focusable, 'блок кейса не ведёт никуда — останавливать фокус не на чем')
      .toHaveCount(0);
  });
});

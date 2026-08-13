import { test, expect } from '@playwright/test';

/* Секция 5 (D-030, `70-workshop/specs/site-v3/02-case-illustrations.md`,
 * раздел 2.1) — три полноширинных блока вместо карточек: текст слева, поле
 * иллюстрации справа, ссылка на страницу кейса в каждом блоке. Тесты ниже
 * проверяют геометрию и ссылки, не текст (текст и его дословность проверяет
 * `dist-home-cases.test.ts`). */

/* Появление полос кейсов по прокрутке (02-card-motion.md) сдвигает `.text` и
 * `.illustration` по-разному в момент замера — тесты ниже проверяют
 * раскладку, а не движение. `reducedMotion: 'reduce'` даёт чистую раскладку
 * (бриф, раздел 12, ловушка 2). Допуски не ослабляются. */
test.use({ reducedMotion: 'reduce' });

test.describe('секция 5 — три полноширинных блока кейсов', () => {
  test('desktop (1280px): текст слева, три ссылки на страницы кейсов', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto('/');

    const rows = page.locator('#cases .rows > .row');
    await expect(rows).toHaveCount(3);

    const slugs = ['site-v3', 'zayavka-hub', 'ai-consultant'];
    for (const [i, slug] of slugs.entries()) {
      const row = rows.nth(i);
      const link = row.locator(`a[href="/cases/${slug}"]`);
      await expect(link).toHaveCount(1);

      const textBox = await row.locator('.text').boundingBox();
      expect(textBox, `блок ${slug}: текстовая колонка`).not.toBeNull();
    }

    // Поле иллюстрации: сегодня наполнено только у «Этот сайт» (правка
    // ревью 2026-08-13, часть 2, «Замер»). У «Заявка-Хаб» и «ИИ-консультанта»
    // иллюстрации ещё не построены (задачи 4–5 плана
    // `70-workshop/specs/site-v3/02-case-illustrations.md`), и рамка пустого
    // поля намеренно не рисуется (`CaseIllustrationField.astro`) — проверка
    // геометрии поля ждёт наполнения остальных двух блоков.
    const firstRow = rows.nth(0);
    const textBox = await firstRow.locator('.text').boundingBox();
    const fieldBox = await firstRow.locator('.field').boundingBox();
    expect(fieldBox, 'блок site-v3: поле иллюстрации').not.toBeNull();
    // Поле иллюстрации стоит правее текстовой колонки — рисунок всегда
    // справа во всех трёх блоках (бриф, раздел 2.1).
    expect(fieldBox!.x, 'блок site-v3: поле правее текста').toBeGreaterThan(textBox!.x);

    // «Заявка-Хаб» и «ИИ-консультант» пока без содержимого — рамка не
    // рисуется вовсе, а не рисуется пустой.
    for (const slug of ['zayavka-hub', 'ai-consultant']) {
      const idx = slugs.indexOf(slug);
      const count = await rows.nth(idx).locator('.field').count();
      expect(count, `блок ${slug}: пустое поле не рисует рамку`).toBe(0);
    }
  });

  test('mobile (390px): блок одноколоночный — сначала текст, потом поле иллюстрации', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1400 });
    await page.goto('/');

    const firstRow = page.locator('#cases .rows > .row').first();
    const textBox = await firstRow.locator('.text').boundingBox();
    const fieldBox = await firstRow.locator('.field').boundingBox();
    expect(textBox).not.toBeNull();
    expect(fieldBox).not.toBeNull();
    // Одна колонка: поле иллюстрации стоит НИЖЕ текста, не правее него.
    expect(fieldBox!.y, 'поле иллюстрации ниже текста на мобильном').toBeGreaterThanOrEqual(
      textBox!.y + textBox!.height - 1,
    );
  });

  /* Было «визуально одна строка»: описание обрезалось `text-overflow:
     ellipsis` при `white-space: nowrap`. Дизайн-ревью 2026-08-13 замерило,
     что видно 22–29% предложения — три оборванных на полуслове фразы подряд
     читались как битая вёрстка, и владелец отменил приём. Тест не удалён, а
     вывернут: теперь он требует обратного — что описание НЕ обрезано в одну
     строку и при этом не растёт бесконечно. Удалить его значило бы снять
     надзор ровно там, где поведение только что менялось. */
  test('описание кейса — до двух строк, не обрезано в одну', async ({ page }) => {
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
      expect(lines, `описание ${i}: занимает ${lines} строк, ожидалось 1–2`)
        .toBeLessThanOrEqual(2);
      expect(
        m.scrollWidth,
        `описание ${i}: текст шире своей колонки на ${m.scrollWidth - m.clientWidth} px — ` +
        'значит он всё ещё обрезан по горизонтали, а не перенесён',
      ).toBeLessThanOrEqual(m.clientWidth + 1);
    }
  });
});

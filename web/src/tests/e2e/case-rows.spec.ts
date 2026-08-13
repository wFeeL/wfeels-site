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

    // Все три поля иллюстрации наполнены (задачи 3–5 плана
    // `70-workshop/specs/site-v3/02-case-illustrations.md`): «Замер»,
    // «Одна труба, четыре отвода», «Пример диалога» — рамка `.field`
    // рисуется только при непустом содержимом (`CaseIllustrationField.astro`).
    for (const [i, slug] of slugs.entries()) {
      const row = rows.nth(i);
      const textBox = await row.locator('.text').boundingBox();
      const fieldBox = await row.locator('.field').boundingBox();
      expect(fieldBox, `блок ${slug}: поле иллюстрации`).not.toBeNull();
      // Поле иллюстрации стоит правее текстовой колонки — рисунок всегда
      // справа во всех трёх блоках (бриф, раздел 2.1).
      expect(fieldBox!.x, `блок ${slug}: поле правее текста`).toBeGreaterThan(textBox!.x);
      // Содержимое поля не пусто — та самая проверка, ради которой снят
      // блокер («childCount: 0», замер ревью 2026-08-13).
      const childCount = await row.locator('.field').evaluate((el) => el.childElementCount);
      expect(childCount, `блок ${slug}: поле иллюстрации не пусто`).toBeGreaterThan(0);
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
      /* Потолок 6 строк, а не 2. Требование «две строки» было следствием
         `line-clamp: 2`, который дизайн-ревью 2026-08-13 отменило: обрыв
         посреди слова читался как битая вёрстка. Теперь описание видно
         целиком, и его высота — свойство текста, а не рамки. Потолок нужен
         только чтобы поймать случай, когда в описание однажды впишут абзац:
         шесть строк — это высота, при которой полоса кейса ещё читается
         рядом со своей иллюстрацией. */
      expect(lines, `описание ${i}: занимает ${lines} строк, потолок 6`)
        .toBeLessThanOrEqual(6);
      expect(
        m.scrollWidth,
        `описание ${i}: текст шире своей колонки на ${m.scrollWidth - m.clientWidth} px — ` +
        'значит он всё ещё обрезан по горизонтали, а не перенесён',
      ).toBeLessThanOrEqual(m.clientWidth + 1);
    }
  });
});

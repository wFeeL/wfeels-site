import { test, expect } from '@playwright/test';

/* Секция 5 (D-030, `70-workshop/specs/site-v3/02-case-illustrations.md`,
 * раздел 2.1) — три полноширинных блока вместо карточек: текст слева, поле
 * иллюстрации справа, ссылка на страницу кейса в каждом блоке. Тесты ниже
 * проверяют геометрию и ссылки, не текст (текст и его дословность проверяет
 * `dist-home-cases-proof.test.ts`). */

test.describe('секция 5 — три полноширинных блока кейсов', () => {
  test('desktop (1280px): текст слева, поле иллюстрации справа, три ссылки на страницы кейсов', async ({ page }) => {
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
      const fieldBox = await row.locator('.field').boundingBox();
      expect(textBox, `блок ${slug}: текстовая колонка`).not.toBeNull();
      expect(fieldBox, `блок ${slug}: поле иллюстрации`).not.toBeNull();
      // Поле иллюстрации стоит правее текстовой колонки — рисунок всегда
      // справа во всех трёх блоках (бриф, раздел 2.1).
      expect(fieldBox!.x, `блок ${slug}: поле правее текста`).toBeGreaterThan(textBox!.x);
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

  test('описание кейса — визуально одна строка (CSS-усечение, без переноса)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto('/');

    const descriptions = page.locator('#cases .rows .description');
    const count = await descriptions.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const el = descriptions.nth(i);
      const singleLineHeight = await el.evaluate((node) => {
        const style = getComputedStyle(node);
        return parseFloat(style.lineHeight);
      });
      const box = await el.boundingBox();
      expect(box!.height, `описание ${i}: высота не больше одной строки`)
        .toBeLessThanOrEqual(singleLineHeight + 1);
    }
  });
});

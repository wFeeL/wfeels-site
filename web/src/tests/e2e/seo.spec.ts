import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// До правки владельца 2026-08-21 («убираем переключатель... убрать путь /en»)
// здесь стояло обратное ожидание — ровно один `link[hreflang="x-default"]`.
// `BILINGUAL_PATHS` опустел (`i18n/locales.ts`), и `hreflang` не рисуется
// нигде вовсе, не только на главной.
test('на главной есть canonical и robots, hreflang не рисуется', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
});

test('страница контактов несёт ровно один блок структурированной разметки',
  async ({ page }) => {
    const schema = async (path: string) => {
      await page.goto(path);
      const raw = await page.locator('script[type="application/ld+json"]')
        .allTextContents();
      expect(raw, `${path}: разметки нет или её больше одной`).toHaveLength(1);
      return JSON.parse(raw[0]);
    };

    const contact = await schema('/contact');
    expect(contact['@type']).toBe('ContactPage');
    expect(contact.url).toContain('/contact');
    expect(contact.isPartOf['@type']).toBe('WebSite');
    // Английская главная (`WebSite`, `inLanguage: 'en'`) сюда больше не входит:
    // маршрут `/en` снят правкой владельца 2026-08-21. Разметку `WebSite` для
    // русской главной проверяет отдельный тест ниже.
  });

test('главная несёт два блока структурированной разметки — WebSite и ровно один FAQPage',
  async ({ page }) => {
    // Секция 10 (частые вопросы) кладёт свой `FAQPage` рядом с `WebSite` из
    // `Base.astro` (план `02-home-plan.md`, задача 12): два блока `ld+json`
    // на странице допустимы, два `FAQPage` — нет.
    await page.goto('/');
    const raw = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(raw, 'на главной должно быть ровно два блока ld+json').toHaveLength(2);
    const blocks = raw.map((r) => JSON.parse(r));

    const website = blocks.find((b) => b['@type'] === 'WebSite');
    expect(website, 'блок WebSite не найден').toBeDefined();
    expect(website['@context']).toBe('https://schema.org');
    expect(website.inLanguage).toBe('ru');

    const faqBlocks = blocks.filter((b) => b['@type'] === 'FAQPage');
    expect(faqBlocks, 'ровно один блок FAQPage').toHaveLength(1);
    expect(faqBlocks[0].mainEntity.length).toBeGreaterThan(0);
    expect(faqBlocks[0].mainEntity[0]['@type']).toBe('Question');
  });

test('sitemap не содержит служебных и юридических страниц', () => {
  const xml = readFileSync('dist/sitemap-0.xml', 'utf8');
  expect(xml).toContain('</urlset>');
  for (const p of ['/dev/', '/privacy', '/terms', '/consent', '/thanks']) {
    expect(xml).not.toContain(p);
  }
});

// Маршрут `/en` снят правкой владельца 2026-08-21 — страницы больше нет,
// и в карте сайта её быть не может ни при каких обстоятельствах.
test('sitemap не содержит /en', () => {
  const xml = readFileSync('dist/sitemap-0.xml', 'utf8');
  expect(xml).not.toContain('/en');
});

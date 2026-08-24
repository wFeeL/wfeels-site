import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// С возврата английской главной 2026-08-22 у обеих версий стоят три
// альтернативы: `ru`, `en` и `x-default` на русскую. С 2026-08-21 по эту дату
// здесь стояло обратное ожидание — тогда `BILINGUAL_PATHS` был пуст.
test('у обеих главных есть canonical, robots и три альтернативы', async ({ page }) => {
  for (const path of ['/', '/en']) {
    await page.goto(path);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(3);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
  }
});

// Одноязычные страницы альтернатив не несут: звать поисковик на перевод,
// которого нет, — та же ложь, что вести туда посетителя.
test('у одноязычной страницы hreflang нет', async ({ page }) => {
  await page.goto('/contact');
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
    // Английская главная несёт два блока, как и русская, — её проверяет
    // отдельный тест ниже, вместе с русской.
  });

test('обе главные несут два блока разметки — WebSite и ровно один FAQPage',
  async ({ page }) => {
    // Секция 10 (частые вопросы) кладёт свой `FAQPage` рядом с `WebSite` из
    // `Base.astro` (план `02-home-plan.md`, задача 12): два блока `ld+json`
    // на странице допустимы, два `FAQPage` — нет.
    //
    // `inLanguage` обязан отвечать языку страницы: английская версия с
    // `inLanguage: 'ru'` сообщала бы поисковику неправду о самой себе, а
    // рядом с ней лежит FAQ, вопросы которого он читает как текст.
    for (const [path, lang] of [['/', 'ru'], ['/en', 'en']] as const) {
      await page.goto(path);
      const raw = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(raw, `${path}: должно быть ровно два блока ld+json`).toHaveLength(2);
      const blocks = raw.map((r) => JSON.parse(r));

      const website = blocks.find((b) => b['@type'] === 'WebSite');
      expect(website, `${path}: блок WebSite не найден`).toBeDefined();
      expect(website['@context']).toBe('https://schema.org');
      expect(website.inLanguage).toBe(lang);

      const faqBlocks = blocks.filter((b) => b['@type'] === 'FAQPage');
      expect(faqBlocks, `${path}: ровно один блок FAQPage`).toHaveLength(1);
      expect(faqBlocks[0].mainEntity.length).toBeGreaterThan(0);
      expect(faqBlocks[0].mainEntity[0]['@type']).toBe('Question');
    }
  });

test('sitemap не содержит служебных и юридических страниц', () => {
  const xml = readFileSync('dist/sitemap-0.xml', 'utf8');
  expect(xml).toContain('</urlset>');
  for (const p of ['/dev/', '/privacy', '/terms', '/consent', '/thanks']) {
    expect(xml).not.toContain(p);
  }
});

// Английская главная — настоящая страница с настоящим текстом, и в карте
// сайта ей место. С 2026-08-21 по 2026-08-22 здесь стояло обратное ожидание:
// маршрута не существовало, и ссылка на него в карте была бы ложью.
test('sitemap содержит английскую главную', () => {
  const xml = readFileSync('dist/sitemap-0.xml', 'utf8');
  expect(xml).toContain('/en<');
});

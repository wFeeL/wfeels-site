import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('на главной есть canonical, robots и hreflang', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await expect(page.locator('link[hreflang="x-default"]')).toHaveCount(1);
});

test('главная и страница контактов несут структурированную разметку',
  async ({ page }) => {
    const schema = async (path: string) => {
      await page.goto(path);
      const raw = await page.locator('script[type="application/ld+json"]')
        .allTextContents();
      expect(raw, `${path}: разметки нет или её больше одной`).toHaveLength(1);
      return JSON.parse(raw[0]);
    };

    const home = await schema('/');
    expect(home['@context']).toBe('https://schema.org');
    expect(home['@type']).toBe('WebSite');
    expect(home.inLanguage).toBe('ru');

    const contact = await schema('/kontakt');
    expect(contact['@type']).toBe('ContactPage');
    expect(contact.url).toContain('/kontakt');
    expect(contact.isPartOf['@type']).toBe('WebSite');

    const en = await schema('/en');
    expect(en['@type']).toBe('WebSite');
    expect(en.inLanguage).toBe('en');
  });

test('sitemap не содержит служебных и юридических страниц', () => {
  const xml = readFileSync('dist/sitemap-0.xml', 'utf8');
  expect(xml).toContain('</urlset>');
  for (const p of ['/dev/', '/politika', '/oferta', '/soglasie', '/spasibo']) {
    expect(xml).not.toContain(p);
  }
});

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('на главной есть canonical, robots и hreflang', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await expect(page.locator('link[hreflang="x-default"]')).toHaveCount(1);
});

test('sitemap не содержит служебных и юридических страниц', () => {
  const xml = readFileSync('dist/sitemap-0.xml', 'utf8');
  expect(xml).toContain('</urlset>');
  for (const p of ['/dev/', '/politika', '/oferta', '/soglasie', '/spasibo']) {
    expect(xml).not.toContain(p);
  }
});

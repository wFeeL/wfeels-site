import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const PRODUCTION_SITE = 'https://wfeels.site';

// С возврата английской главной 2026-08-22 у обеих версий стоят три
// альтернативы: `ru`, `en` и `x-default` на русскую. С 2026-08-21 по эту дату
// здесь стояло обратное ожидание — тогда `BILINGUAL_PATHS` был пуст.
test('у обеих главных есть canonical, robots и три альтернативы', async ({ page }) => {
  for (const path of ['/', '/en']) {
    await page.goto(path);
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveCount(1);
    await expect(canonical).toHaveAttribute('href', `${PRODUCTION_SITE}${path}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(3);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
  }
});

test('social preview содержит полный OG и Twitter набор', async ({ page }) => {
  await page.goto('/');

  const title = await page.title();
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  const image = `${PRODUCTION_SITE}/og-default.png`;

  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', title);
  await expect(page.locator('meta[property="og:description"]'))
    .toHaveAttribute('content', description ?? '');
  await expect(page.locator('meta[property="og:url"]'))
    .toHaveAttribute('content', `${PRODUCTION_SITE}/`);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', image);
  await expect(page.locator('meta[property="og:image:secure_url"]')).toHaveAttribute('content', image);
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
  await expect(page.locator('meta[name="twitter:card"]'))
    .toHaveAttribute('content', 'summary_large_image');
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute('content', title);
  await expect(page.locator('meta[name="twitter:description"]'))
    .toHaveAttribute('content', description ?? '');
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', image);
  await expect(page.locator('meta[name="author"]'))
    .toHaveAttribute('content', 'Сабуров Даниил Денисович');
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
    // Английскую главную проверяет отдельный тест ниже, вместе с русской.
  });

test('обе главные несут один подтвержденный блок WebSite',
  async ({ page }) => {
    // Google показывает FAQ rich results только для авторитетных сайтов о
    // здоровье и государственных организаций. Для коммерческого портфолио
    // этот тип не дает результата и лишь дублирует видимый текст секции.
    // `inLanguage` при этом обязан отвечать реальному языку страницы.
    for (const [path, lang] of [['/', 'ru'], ['/en', 'en']] as const) {
      await page.goto(path);
      const raw = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(raw, `${path}: должен быть ровно один блок ld+json`).toHaveLength(1);
      const blocks = raw.map((r) => JSON.parse(r));

      const website = blocks.find((b) => b['@type'] === 'WebSite');
      expect(website, `${path}: блок WebSite не найден`).toBeDefined();
      expect(website['@context']).toBe('https://schema.org');
      expect(website.inLanguage).toBe(lang);

      expect(blocks.some((b) => b['@type'] === 'FAQPage')).toBe(false);
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

test('sitemap содержит каталог и все опубликованные кейсы', () => {
  const xml = readFileSync('dist/sitemap-0.xml', 'utf8');
  for (const path of [
    '/cases', '/cases/site-v3', '/cases/storefront', '/cases/websites',
    '/cases/ai-consultant', '/cases/zayavka-hub',
  ]) {
    expect(xml, path).toContain(`${path}<`);
  }
  expect(xml).not.toContain('/cases/slotbook');
});

test('canonical, hreflang и sitemap используют только production origin', () => {
  for (const file of ['dist/index.html', 'dist/en/index.html']) {
    const html = readFileSync(file, 'utf8');
    const seoUrls = [
      ...html.matchAll(/<link rel="(?:canonical|alternate)"[^>]*href="([^"]+)"/g),
      ...html.matchAll(
        /<meta (?:property="og:(?:url|image)"|name="twitter:image")[^>]*content="([^"]+)"/g,
      ),
    ].map((match) => match[1]);

    expect(seoUrls.length, `${file}: SEO URL не найдены`).toBeGreaterThan(0);
    for (const url of seoUrls) {
      expect(url, `${file}: SEO URL вне production origin`).toMatch(/^https:\/\/wfeels\.site(?:\/|$)/);
    }
  }

  for (const file of ['dist/sitemap-index.xml', 'dist/sitemap-0.xml']) {
    const xml = readFileSync(file, 'utf8');
    expect(xml, `${file}: найден localhost`).not.toContain('localhost');
    expect(xml, `${file}: нет production origin`).toContain(PRODUCTION_SITE);
  }
});

test('robots.txt объявляет production sitemap', () => {
  const robots = readFileSync('dist/robots.txt', 'utf8');
  expect(robots).toContain(`Sitemap: ${PRODUCTION_SITE}/sitemap-index.xml`);
  expect(robots).not.toContain('localhost');
});

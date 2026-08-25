import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { publishedCases } from '../data/cases';
import { SERVICE_PAGES } from '../data/servicePages';
import { SERVICE_GROUPS } from '../data/services';

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));
const read = (path: string) => readFileSync(`${DIST}${path}`, 'utf8');

function schemas(path: string): Record<string, any>[] {
  return [...read(path).matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )].map((match) => JSON.parse(match[1]));
}

function byType(path: string, type: string): Record<string, any> {
  const found = schemas(path).find((item) => item['@type'] === type);
  expect(found, `${path}: schema.org ${type} не найден`).toBeDefined();
  return found!;
}

describe('dist — подтвержденные SEO-сущности', () => {
  it('главная связывает WebSite с реальным исполнителем', () => {
    const website = byType('index.html', 'WebSite');
    expect(website.url).toBe('https://wfeels.site');
    expect(website.creator['@type']).toBe('Person');
    expect(website.creator.name).toBe('Сабуров Даниил Денисович');
    expect(website.creator.sameAs).toEqual(['https://t.me/wfeels']);
  });

  it('каталог услуг перечисляет ровно опубликованные посадочные', () => {
    const collection = byType('services/index.html', 'CollectionPage');
    const items = collection.mainEntity.itemListElement;
    expect(items).toHaveLength(SERVICE_PAGES.length);
    expect(items.map((item: any) => item.url)).toEqual(
      SERVICE_GROUPS.flatMap((group) => group.links.map(
        (link) => `https://wfeels.site${link.href}`,
      )),
    );
  });

  for (const page of SERVICE_PAGES) {
    it(`/services/${page.slug}: Service без выдуманного Offer или рейтинга`, () => {
      const service = byType(`services/${page.slug}/index.html`, 'Service');
      expect(service.url).toBe(`https://wfeels.site/services/${page.slug}`);
      expect(service.provider['@type']).toBe('Person');
      expect(service).not.toHaveProperty('offers');
      expect(service).not.toHaveProperty('aggregateRating');
    });
  }

  it('каталог кейсов перечисляет только пять содержательных страниц', () => {
    const collection = byType('cases/index.html', 'CollectionPage');
    const urls = collection.mainEntity.itemListElement.map((item: any) => item.url);
    expect(urls).toEqual(
      publishedCases().map((item) => `https://wfeels.site/cases/${item.slug}`),
    );
    expect(urls).not.toContain('https://wfeels.site/cases/slotbook');
  });

  for (const item of publishedCases()) {
    it(`/cases/${item.slug}: CreativeWork без выдуманного отзыва или метрик`, () => {
      const creative = byType(`cases/${item.slug}/index.html`, 'CreativeWork');
      expect(creative.url).toBe(`https://wfeels.site/cases/${item.slug}`);
      expect(creative.author['@type']).toBe('Person');
      expect(creative).not.toHaveProperty('review');
      expect(creative).not.toHaveProperty('aggregateRating');
    });
  }
});

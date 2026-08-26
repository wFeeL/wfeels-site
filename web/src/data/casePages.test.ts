import { describe, expect, it } from 'vitest';
import {
  caseGallerySlides,
  caseNarrative,
  caseServiceLinks,
  casesForService,
  publishedCaseHref,
} from './casePages';
import { publishedCases } from './cases';

describe('casePages.ts — опубликованные кейсы и честные связи', () => {
  it('публикуются ровно пять записей с подтвержденными описанием и стеком', () => {
    const pages = publishedCases();
    expect(pages).toHaveLength(5);
    expect(pages.map(publishedCaseHref)).toEqual([
      '/cases/site-v3',
      '/cases/storefront',
      '/cases/websites',
      '/cases/ai-consultant',
      '/cases/zayavka-hub',
    ]);
  });

  it('у каждого опубликованного кейса есть содержательный и честно помеченный разбор', () => {
    for (const item of publishedCases()) {
      const narrative = caseNarrative(item.slug);
      expect(narrative.task.length, item.slug).toBeGreaterThan(80);
      expect(narrative.approach.length, item.slug).toBeGreaterThan(100);
      expect(narrative.result.length, item.slug).toBeGreaterThan(80);
      expect(narrative.disclosure.length, item.slug).toBeGreaterThan(70);
      expect(narrative.disclosure, item.slug).not.toMatch(/оплаченный клиент|реальный клиент/i);
    }
  });

  it('detail-выборки есть только у двух кейсов и не повторяют тяжелый manifest целиком', () => {
    expect(caseGallerySlides('storefront')).toHaveLength(3);
    expect(caseGallerySlides('websites')).toHaveLength(2);
    for (const slug of ['site-v3', 'ai-consultant', 'zayavka-hub']) {
      expect(caseGallerySlides(slug), slug).toEqual([]);
    }
  });

  it('связи с услугами симметричны и не заводят лишних соответствий', () => {
    const expected: Record<string, string[]> = {
      'site-v3': ['website'],
      storefront: ['telegram-miniapp'],
      websites: ['website'],
      'ai-consultant': ['ai-consultant'],
      'zayavka-hub': ['integrations'],
    };

    for (const item of publishedCases()) {
      const serviceSlugs = caseServiceLinks(item.slug).map((service) => service.slug);
      expect(serviceSlugs, item.slug).toEqual(expected[item.slug]);
      for (const serviceSlug of serviceSlugs) {
        expect(casesForService(serviceSlug).map((entry) => entry.slug), serviceSlug)
          .toContain(item.slug);
      }
    }

    expect(casesForService('telegram-bot')).toEqual([]);
    expect(caseServiceLinks('unknown-case')).toEqual([]);
  });
});
